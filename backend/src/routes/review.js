import { Router } from 'express';
import { db } from '../db/index.js';
import { verificationLogs } from '../db/schema.js';
import { upsertAndScoreTrustProfile } from '../utils/trustProfile.js';

const router = Router();

// Offline fallback heuristic for AI text
function assessAiText(text) {
    const aiPatterns = [/delve into/, /testament to/, /in conclusion/, /tapestry/];
    let flags = 0;
    aiPatterns.forEach(r => { if (r.test(text.toLowerCase())) flags++; });
    return flags > 0 ? 85 : 12;
}

// Offline fallback heuristic for spam/manipulation
function assessSpam(text) {
    if (text.length < 10) return ['too_short'];
    if (text.match(/buy now|click here/i)) return ['spam_language'];
    return [];
}

// Modern Gemini LLM Review Assessment
async function analyzeReviewWithGemini(reviewText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Analyze the following product review for authenticity, identifying if it's AI-generated or spam.
Review: "${reviewText}"

Respond ONLY with valid JSON matching exactly this precise structure:
{
  "is_ai_generated": boolean,
  "ai_probability": number (between 0 and 100),
  "is_spam": boolean,
  "spam_flags": [array of string reasons if spam, e.g. "promotional link", "excessive emojis", "repetitive phrasing"]
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    return JSON.parse(content);
  } catch (err) {
    console.error("Gemini Review API Failed", err);
    return null;
  }
}

// POST /api/v1/review/score
router.post('/score', async (req, res) => {
  try {
    const { reviewer_email, reviewer_phone, review_text, platform_id } = req.body;

    if (!review_text || (!reviewer_email && !reviewer_phone)) {
        return res.status(400).json({ success: false, error: 'Review text and reviewer contact required' });
    }

    // 1 & 2. Try Gemini Deep AI Analysis, with offline fallback
    let aiProbability = assessAiText(review_text);
    let spamFlags = assessSpam(review_text);

    const geminiAnalysis = await analyzeReviewWithGemini(review_text);
    if (geminiAnalysis) {
        aiProbability = geminiAnalysis.ai_probability;
        spamFlags = geminiAnalysis.spam_flags || [];
    }

    // 3. Determine outcome for trust scoring
    let outcome = 'PASS';
    if (aiProbability > 80 || spamFlags.length > 0) {
      outcome = aiProbability > 80 ? 'FAIL' : 'FLAG';
    }

    // 4. Upsert trust profile and update score based on this request's outcome
    const trustProfile = await upsertAndScoreTrustProfile(
      db,
      { email: reviewer_email, phone_number: reviewer_phone },
      outcome
    );
    const trustScore = trustProfile?.trust_score ?? 100;
    const totalChecks = trustProfile?.total_checks ?? 1;

    // 5. Calculate final credibility using updated trust score
    let credibilityScore = 100;
    if (aiProbability > 80) credibilityScore -= 40;
    if (spamFlags.length > 0) credibilityScore -= 30;
    if (trustScore < 50) credibilityScore -= 50;
    else if (trustScore < 80) credibilityScore -= 20;

    credibilityScore = Math.max(0, Math.min(100, credibilityScore));

    let recommendation = 'DISPLAY';
    if (credibilityScore < 40) recommendation = 'HIDE';
    else if (credibilityScore < 75) recommendation = 'FLAG_FOR_REVIEW';

    const result = {
        credibility_score: credibilityScore,
        recommendation,
        ai_probability: aiProbability,
        spam_flags: spamFlags,
        reviewer_trust_score: trustScore,
        signals: {
            ai_detection: { result: aiProbability > 50 ? 'FAIL' : 'PASS', probability: aiProbability },
            spam_check: { result: spamFlags.length > 0 ? 'FAIL' : 'PASS', flags: spamFlags.length },
            trust_score: {
              result: trustScore < 80 ? 'FAIL' : 'PASS',
              score: trustScore,
              total_checks: totalChecks,
              profile_status: trustProfile ? 'existing' : 'new',
            }
        }
    };

    const [log] = await db.insert(verificationLogs).values({
        endpoint: '/api/v1/review/score',
        result_status: recommendation === 'HIDE' ? 'FAIL' : 'PASS',
        details: JSON.stringify(result)
    }).returning();

    return res.json({
        success: true,
        result,
        evidence_report_url: `https://credify.io/reports/${log.id}`
    });

  } catch (err) {
    console.error('Review scoring error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
