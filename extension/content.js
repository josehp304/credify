// Clean up previous instance of this script if the extension was reloaded 
// without the page being refreshed. This prevents duplicate scripts from running.
if (window.__CREDIFY_CLEANUP) {
  window.__CREDIFY_CLEANUP();
}

let observer;
let messageListener;

window.__CREDIFY_CLEANUP = () => {
  const oldUI = document.getElementById('credify-ui');
  if (oldUI) oldUI.remove();
  
  if (observer) observer.disconnect();
  try {
    if (messageListener && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  } catch (e) {
    // Context might be dead already
  }
};

// Inject our CSS styles natively into the DOM 
const style = document.createElement('style');
style.textContent = `
  .review-checker-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-right: 8px;
    vertical-align: middle;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: white;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid transparent;
    z-index: 999;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .review-checker-badge.genuine { 
    background-color: rgba(16, 185, 129, 0.15); 
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
  }
  .review-checker-badge.spam { 
    background-color: rgba(239, 68, 68, 0.15); 
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }
  .review-checker-badge.processing { 
    background-color: rgba(99, 102, 241, 0.15); 
    color: #818cf8;
    border-color: rgba(99, 102, 241, 0.3);
  }
  .review-checker-badge.error { 
    background-color: rgba(245, 158, 11, 0.15); 
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }

  #credify-ui {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 16px;
    border-radius: 12px;
    margin-bottom: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
  }
  
  #credify-analyze-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(99, 102, 241, 0.3);
  }
  
  #credify-analyze-btn:hover:not(:disabled) { 
    transform: translateY(-1px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(99, 102, 241, 0.5);
  }
  
  #credify-analyze-btn:disabled { 
    background: rgba(255, 255, 255, 0.1); 
    color: rgba(255, 255, 255, 0.4);
    box-shadow: none;
    cursor: not-allowed; 
  }

  .fs-spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: fs-spin 0.8s linear infinite;
    display: none;
  }
  @keyframes fs-spin { to { transform: rotate(360deg); } }
  .fs-analyzing .fs-spinner { display: inline-block; }
  
  #credify-status {
    font-size: 13px;
    color: #cbd5e1;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;
document.head.appendChild(style);

let stats = { total: 0, genuine: 0, spam: 0 };
let isAnalyzing = false;

// Safety wrappers to prevent "Extension context invalidated" errors
async function safeSendMessage(message) {
  try {
    if (!chrome.runtime?.id) return null;
    return await chrome.runtime.sendMessage(message);
  } catch (e) {
    console.debug("Extension context invalidated");
    return null;
  }
}

async function safeStorageGet(keys) {
  try {
    if (!chrome.runtime?.id) return {};
    return await chrome.storage.local.get(keys);
  } catch (e) {
    console.debug("Extension context invalidated");
    return {};
  }
}

// Configurable selectors to support different types, focused on generic and Amazon specifically
const selectors = [
  // Amazon default & international variations
  { reviewList: 'div[data-hook="review"]', textBody: 'span[data-hook="review-body"]' },
  { reviewList: 'div[id^="customer_review-"]', textBody: '.review-text-content' },
  { reviewList: '.review', textBody: '.review-text, span[data-hook="review-body"]' },
  { reviewList: '.a-section.review', textBody: '.a-expander-content' },
  
  // Generic fallbacks
  { reviewList: '.review-container', textBody: '.review-text, .review-content' },
  { reviewList: 'article[class*="review"]', textBody: 'p, .content' },
  { reviewList: 'div[class*="ReviewCard"]', textBody: 'p, span' },
  { reviewList: '.yotpo-review', textBody: '.content-review' },
  { reviewList: '[data-testid="review-card"]', textBody: 'p, span' }
];

function extractReviews() {
  let reviews = [];
  
  for (let sel of selectors) {
    const nodes = document.querySelectorAll(sel.reviewList);
    if (nodes.length > 0) {
      nodes.forEach(node => {
        if (node.dataset.reviewAnalyzed === "true") return;

        // Any node still flagged "processing" belongs to a previous run that never
        // finished -- a concurrent run would have bailed at the isAnalyzing guard in
        // startAnalysis() before reaching here. So it is always safe to reclaim it.
        if (node.dataset.reviewProcessing === "true") {
          node.dataset.reviewProcessing = "false";
          const stuckBadge = node.querySelector('.review-checker-badge.processing');
          if (stuckBadge) stuckBadge.remove();
        }
        
        const textNode = node.querySelector(sel.textBody);
        if (textNode) {
          const text = textNode.textContent.trim();
          if (text.length > 5) { // Lowered sanity threshold for very short reviews ("Great!")
            node.dataset.reviewProcessing = "true";
            reviews.push({ element: node, text: text, textNode: textNode });
            
            // Show processing badge
            const badge = document.createElement('span');
            badge.className = 'review-checker-badge processing';
            badge.innerHTML = 'ANALYZING...';
            // Prepend inside the text node so it looks clean before the text
            textNode.prepend(badge); 
          }
        }
      });
      console.debug(
        `[Credify] selector "${sel.reviewList}" matched ${nodes.length} container(s), ` +
        `"${sel.textBody}" yielded ${reviews.length} new review body/bodies.`
      );
      // Break early if we found matches to avoid mixing structures
      if (reviews.length > 0) break;
    }
  }
  
  if (reviews.length === 0) {
    console.debug("[Credify] No new review bodies extracted. Either every review on the " +
                  "page is already analyzed, or none of the configured selectors fit this DOM.");
  }
  return reviews;
}

function updateBadge(element, label, confidence, error = false) {
  // Find the existing processing badge we prepended earlier
  const existingBadge = element.querySelector('.review-checker-badge');
  
  if (error) {
    if (existingBadge) {
      existingBadge.className = 'review-checker-badge error';
      existingBadge.innerHTML = 'ERROR';
    }
    return;
  }
  
  const score = Math.round(confidence * 100);
  if (existingBadge) {
    existingBadge.className = `review-checker-badge ${label.toLowerCase()}`;
    existingBadge.innerHTML = `${label.toUpperCase()} ${score}%`;
  }
  
  // Update stats
  if (label.toLowerCase() === 'genuine') {
    stats.genuine++;
  } else {
    stats.spam++;
  }
  stats.total++;
  
  // Re-broadcast stats to popup if it's open
  safeSendMessage({ action: "UPDATE_STATS", ...stats });
}

function injectUI() {
  if (document.getElementById('credify-ui')) return;
  
  let anchor = null;
  for (let sel of selectors) {
    const nodes = document.querySelectorAll(sel.reviewList);
    if (nodes.length > 0) {
      anchor = nodes[0];
      break;
    }
  }
  
  if (!anchor || !anchor.parentNode) return;
  
  const ui = document.createElement('div');
  ui.id = 'credify-ui';
  ui.innerHTML = `
    <button id="credify-analyze-btn">Credify: Analyze Reviews</button>
    <div id="credify-status">
      <div class="fs-spinner"></div>
      <span class="fs-text">Ready to scan</span>
    </div>
  `;
  
  anchor.parentNode.insertBefore(ui, anchor);
  
  document.getElementById('credify-analyze-btn').addEventListener('click', (e) => {
    e.preventDefault();
    startAnalysis();
  });
}

function setUIStatus(state, msg) {
  const ui = document.getElementById('credify-ui');
  if (!ui) return;
  
  const btn = document.getElementById('credify-analyze-btn');
  const text = ui.querySelector('.fs-text');
  
  if (state === 'analyzing') {
    ui.classList.add('fs-analyzing');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    text.textContent = msg || 'Processing reviews...';
  } else {
    ui.classList.remove('fs-analyzing');
    btn.disabled = false;
    btn.textContent = 'Credify: Analyze Reviews';
    text.textContent = msg || 'Ready';
  }
}

async function startAnalysis() {
  injectUI();

  if (isAnalyzing) return { status: 'already_running' };
  isAnalyzing = true;
  
  const reviews = extractReviews();
  if (reviews.length === 0) {
    isAnalyzing = false;
    safeSendMessage({ action: "ANALYSIS_COMPLETE" });
    setUIStatus('ready', 'No new reviews found to scan.');
    return { status: 'ok', found: 0 };
  }
  
  setUIStatus('analyzing', `Analyzing ${reviews.length} reviews via AI...`);

  // Extract pure text array
  const reviewTexts = reviews.map(r => r.text);
  
  // Forward batch to background worker to prevent CORS and secure prompt payload
  const response = await safeSendMessage({ action: "CLASSIFY_REVIEWS", reviews: reviewTexts });
  
  isAnalyzing = false;
  safeSendMessage({ action: "ANALYSIS_COMPLETE" });

  if (response && response.results) {
    response.results.forEach((res, i) => {
      const item = reviews[i];
      item.element.dataset.reviewProcessing = "false";
      item.element.dataset.reviewAnalyzed = "true";
      
      if (res.error) {
        updateBadge(item.textNode, "", 0, true);
      } else {
        updateBadge(item.textNode, res.label, res.confidence);
      }
    });
    setUIStatus('ready', `Successfully analyzed ${reviews.length} reviews.`);
  } else {
    // No results came back (service worker restarted, or the extension was reloaded
    // mid-run). Release the nodes so the next click can retry them.
    console.warn("[Credify] Classification returned no results; releasing reviews for retry.");
    reviews.forEach(item => {
      item.element.dataset.reviewProcessing = "false";
      updateBadge(item.textNode, "", 0, true);
    });
    setUIStatus('ready', 'Analysis failed - click to retry.');
  }
}

// Keep an eye on the DOM for dynamically loaded reviews
let timeout = null;
observer = new MutationObserver(async () => {
  injectUI();
  
  const result = await safeStorageGet(['autoRun']);
  if (result && result.autoRun && !isAnalyzing) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      startAnalysis();
    }, 1500); // Debounce time
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for manual actions or status queries
messageListener = (message, sender, sendResponse) => {
  if (message.action === "ANALYZE_REVIEWS") {
    startAnalysis().then(response => {
      sendResponse(response || { status: 'ok', found: 1 });
    });
    return true; // Keep channel open
  } else if (message.action === "GET_STATS") {
    sendResponse(stats);
  }
};

chrome.runtime.onMessage.addListener(messageListener);

// Initial auto-run if enabled
safeStorageGet(['autoRun']).then((result) => {
  if (result && result.autoRun) {
    setTimeout(startAnalysis, 1000);
  }
});
