import express from 'express';

const router = express.Router();

const HEURISTIC_KEYWORDS = ['100%', 'best ever', 'life changing', 'guaranteed', 'buy now', 'miracle', 'amazing', 'perfect'];
const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

function heuristicFallback(text) {
  let score = 0;
  HEURISTIC_KEYWORDS.forEach(kw => {
    if (text.toLowerCase().includes(kw)) score += 0.2;
  });
  const emojiMatches = text.match(EMOJI_REGEX) || [];
  if (emojiMatches.length > 2) score += 0.2;
  if (emojiMatches.length > 5) score += 0.4;
  
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size / words.length < 0.5) score += 0.4;
  
  const confidence = Math.min(score, 0.99);
  return {
    label: confidence > 0.5 ? "spam" : "genuine",
    confidence: confidence > 0.5 ? confidence : (1 - confidence)
  };
}

router.post('/classify', async (req, res) => {
  try {
    const { reviews } = req.body;
    if (!reviews || !Array.isArray(reviews)) {
      return res.status(400).json({ error: "Missing or invalid reviews array" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Offline heuristic fallback mapped server-side
      return res.json({ results: reviews.map(heuristicFallback) });
    }

    if (reviews.length === 0) return res.json({ results: [] });

    // The batch API payload mirroring the prior strict design limitations requested
    const batchedPrompt = `Classify the following product reviews as either genuine or spam/AI-generated.
Consider specificity, authenticity, emotional exaggeration, repetition, and realism.

Respond ONLY in JSON format containing an array of objects for each review in order:
[ { "label": "genuine" or "spam", "confidence": number between 0 and 1 } ]

Reviews to classify:
${reviews.map((r, i) => `Review ${i + 1}: ${r}`).join('\n\n')}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: batchedPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      throw new Error("Gemini API Request failed");
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(content);
    
    // Safety check sequence
    if (!Array.isArray(parsed) || parsed.length !== reviews.length) {
       console.warn("Array mismatch from LLM, injecting fallbacks");
       return res.json({ results: reviews.map(heuristicFallback) });
    }

    res.json({ results: parsed });
  } catch (error) {
    console.error("Extension Classify Route Error:", error);
    // Silent heuristics fallback if LLM structured output crashes
    const fallbackResults = req.body.reviews ? req.body.reviews.map(heuristicFallback) : [];
    res.json({ results: fallbackResults });
  }
});

export default router;
