const HEURISTIC_KEYWORDS = ['100%', 'best ever', 'life changing', 'guaranteed', 'buy now', 'miracle', 'amazing', 'perfect'];
const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

function heuristicFallback(text) {
  let score = 0;
  
  // Generic phrases
  HEURISTIC_KEYWORDS.forEach(kw => {
    if (text.toLowerCase().includes(kw)) score += 0.2;
  });
  
  // Excessive emojis
  const emojiMatches = text.match(EMOJI_REGEX) || [];
  if (emojiMatches.length > 2) score += 0.2;
  if (emojiMatches.length > 5) score += 0.4;
  
  // Repetition
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size / words.length < 0.5) score += 0.4;
  
  const confidence = Math.min(score, 0.99);
  
  return {
    label: confidence > 0.5 ? "spam" : "genuine",
    confidence: confidence > 0.5 ? confidence : (1 - confidence)
  };
}

// Memory cache to avoid repeating exact identical reviews
const cache = new Map();

// Helper to query our custom Credify backend
async function classifyReviewsWithBackend(reviews) {
  try {
    const response = await fetch('https://factoryscan.onrender.com/api/v1/extension/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reviews })
    });
    
    if (!response.ok) throw new Error("Backend API Error");
    
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.warn("Backend route failed, using local heuristic fallback.", error);
    return reviews.map(heuristicFallback);
  }
}

// Removed Direct Gemini Functions in favor of backend API

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CLASSIFY_REVIEWS") {
    // Process them then respond
    handleClassification(message.reviews).then(results => sendResponse({ results }));
    return true; // Keep message channel open for async response
  }
});

async function handleClassification(reviews) {
  const results = new Array(reviews.length).fill(null);
  const toProcess = [];
  const indices = [];

  // Check cache first
  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];
    if (cache.has(r)) {
      results[i] = Object.assign({}, cache.get(r));
    } else {
      toProcess.push(r);
      indices.push(i);
    }
  }

  if (toProcess.length > 0) {
    // Chunk processing to avoid huge payloads. Chunk limit: 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const chunk = toProcess.slice(i, i + BATCH_SIZE);
      const chunkIndices = indices.slice(i, i + BATCH_SIZE);
      
      const batchResults = await classifyReviewsWithBackend(chunk);

      if (batchResults && Array.isArray(batchResults)) {
        batchResults.forEach((res, idx) => {
          results[chunkIndices[idx]] = res;
          cache.set(chunk[idx], res);
        });
      } else {
        // Safe mapping
        chunk.forEach((val, idx) => {
           let fb = heuristicFallback(val);
           results[chunkIndices[idx]] = fb;
           cache.set(chunk[idx], fb);
        });
      }
    }
  }
  
  return results;
}
