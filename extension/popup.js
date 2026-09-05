document.addEventListener('DOMContentLoaded', async () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const autoRunToggle = document.getElementById('autoRun');

  // Load saved settings
  chrome.storage.local.get(['autoRun'], (result) => {
    if (result.autoRun) autoRunToggle.checked = result.autoRun;
  });

  // Save auto-run toggle
  autoRunToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoRun: e.target.checked });
  });

  // Trigger manual analysis
  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "ANALYZE_REVIEWS" }, (response) => {
        if (chrome.runtime.lastError) {
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = 'Error: Reload tab';
          setTimeout(() => { analyzeBtn.textContent = 'Analyze page reviews'; }, 2000);
        } else if (response && response.found === 0) {
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = 'No reviews found';
          setTimeout(() => { analyzeBtn.textContent = 'Analyze page reviews'; }, 2000);
        } else if (response && response.status === 'already_running') {
          // just wait for the running broadcast
        }
      });
    } else {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'No active tab';
      setTimeout(() => { analyzeBtn.textContent = 'Analyze page reviews'; }, 2000);
    }
  });

  // Function to update the UI score
  function updateScores(stats) {
    document.getElementById('totalReviews').textContent = stats.total;
    const genuinePercent = stats.total > 0 ? Math.round((stats.genuine / stats.total) * 100) : 0;
    const spamPercent = stats.total > 0 ? Math.round((stats.spam / stats.total) * 100) : 0;
    
    document.getElementById('genuineCount').textContent = `${genuinePercent}%`;
    document.getElementById('spamCount').textContent = `${spamPercent}%`;
  }

  // Listen for ongoing real-time stats updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "UPDATE_STATS") {
      updateScores(message);
    } else if (message.action === "ANALYSIS_COMPLETE") {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze page reviews';
    }
  });
  
  // Request current stats when popup opens to sync state
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "GET_STATS" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) {
        updateScores(response);
      }
    });
  }
});
