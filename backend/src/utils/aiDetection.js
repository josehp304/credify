import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import { analyzeC2pa } from './c2paAnalysis.js';

/**
 * Multi-layer AI-image detection.
 *
 * Layer 0 — C2PA provenance (deterministic, local, free): parse and validate
 *   any Content Credentials manifest with the official CAI library. A valid
 *   manifest declaring an AI digitalSourceType is conclusive on its own and
 *   skips the paid classifiers entirely.
 * Layer 1 — Hive AI v3 pixel classifier.
 * Layer 2 — Gemini visual-artifact fallback (pixels only — it is never asked
 *   about metadata it cannot see).
 *
 * @param {Buffer} imageBuffer - The image file buffer
 * @param {string} mimeType - The mime type of the image
 * @returns {Promise<Object>} The API response formatted for the route
 */
export async function detectAiGeneratedImage(imageBuffer, mimeType = "image/jpeg") {
  // Layer 0: real C2PA parsing (replaces the old prompt that asked Gemini to
  // "check for C2PA metadata" — vision models only receive decoded pixels and
  // cannot read JUMBF manifest boxes, so those answers were hallucinated).
  const c2pa = await analyzeC2pa(imageBuffer, mimeType);

  if (c2pa.verdict === 'ai_generated') {
    return {
      metadata_detected: true,
      metadata_confidence: "high",
      artifact_score: 0,
      classifier_score: 0.98,
      final_label: "AI-generated",
      confidence: 0.98,
      explanation: `Signed C2PA manifest from "${c2pa.claim_generator}" declares ${c2pa.source_types.join(', ')}`,
      c2pa,
    };
  }

  const classifierResult = await classifyPixels(imageBuffer, mimeType);
  const result = { ...classifierResult, c2pa };

  // A tampered manifest means the pixels were edited after signing — treat it
  // like conclusive metadata evidence. A signed edit trail (ai_edited) is a
  // softer signal; the route decides its weight from result.c2pa directly.
  if (c2pa.verdict === 'tampered') {
    result.metadata_detected = true;
    result.metadata_confidence = "high";
  }
  if (c2pa.verdict === 'tampered' || c2pa.verdict === 'ai_edited') {
    result.explanation = `${result.explanation} | C2PA: ${c2pa.verdict} (${c2pa.claim_generator ?? 'unknown generator'})`;
  }

  return result;
}

/**
 * Layer 1: Hive AI v3 classifier, falling back to Gemini on any failure.
 */
async function classifyPixels(imageBuffer, mimeType) {
  try {
    const base64Image = imageBuffer.toString('base64');

    // Using Hive AI v3 Playground Endpoint
    const response = await fetch('https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.HIVE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: [
          {
            media_base64: `data:${mimeType};base64,${base64Image}`
          }
        ]
      })
    });

    if (!response.ok) {
        console.error("Hive API error:", response.status, response.statusText);
        // Fallback to Gemini if Hive fails
        console.log("Falling back to Gemini for AI detection...");
        return await fallbackToGemini(imageBuffer, mimeType);
    }

    const hiveResult = await response.json();
    if (hiveResult.output && hiveResult.output.length > 0) {
      const classes = hiveResult.output[0].classes;
      const aiGeneratedClass = classes.find(c => c.class === 'ai_generated');
      const deepfakeClass = classes.find(c => c.class === 'deepfake');

      const aiScore = (aiGeneratedClass && aiGeneratedClass.value !== undefined) ? aiGeneratedClass.value : 0;
      const deepfakeScore = (deepfakeClass && deepfakeClass.value !== undefined) ? deepfakeClass.value : 0;

      // Ensure backward compatibility with the expected output object used in refund.js
      return {
          metadata_detected: false,
          metadata_confidence: "none",
          artifact_score: deepfakeScore,
          classifier_score: aiScore,
          final_label: aiScore >= 0.9 ? "AI-generated" : (aiScore > 0.5 ? "Likely AI-generated" : "Likely real"),
          confidence: Math.max(aiScore, deepfakeScore),
          explanation: `Hive AI detected probability: AI=${(aiScore * 100).toFixed(1)}%, Deepfake=${(deepfakeScore * 100).toFixed(1)}%`
      };
    } else {
        return await fallbackToGemini(imageBuffer, mimeType);
    }

  } catch (error) {
    console.error('Error calling Hive API for AI detection:', error);
    return await fallbackToGemini(imageBuffer, mimeType);
  }
}

/**
 * Layer 2: Gemini visual-artifact analysis if Hive fails.
 * Scoped strictly to what a vision model can actually observe: pixels.
 */
async function fallbackToGemini(imageBuffer, mimeType) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const prompt = `You are an AI image forensics system. You can only see the decoded pixels of this image — do NOT speculate about metadata, EXIF, or provenance manifests.

Analyze the visible image content for signs of AI generation:

1. Texture analysis: unnatural smoothness, plastic-like skin, repeating patterns
2. Physical consistency: lighting direction vs shadows, reflections, perspective
3. Known generation artifacts: distorted hands, garbled text, asymmetric details, background incoherence
4. Compression character: uniform noise floor typical of diffusion output vs sensor noise

Return output as JSON ONLY:
{
  "artifact_score": 0-1,
  "classifier_score": 0-1,
  "final_label": "AI-generated / Likely AI-generated / Uncertain / Likely real",
  "confidence": 0-1,
  "explanation": "short reasoning about VISIBLE evidence only"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      metadata_detected: false,
      metadata_confidence: "none",
      artifact_score: parsed.artifact_score ?? 0,
      classifier_score: parsed.classifier_score ?? 0,
      final_label: parsed.final_label ?? "Uncertain",
      confidence: parsed.confidence ?? 0,
      explanation: parsed.explanation ?? "Gemini visual analysis",
    };
  } catch (err) {
      console.error('Gemini fallback failed:', err);
      // Both classifiers are down. Report that honestly instead of fabricating
      // a "Likely AI-generated" score — the route flags for human review.
      return {
          metadata_detected: false,
          metadata_confidence: "none",
          artifact_score: 0,
          classifier_score: 0,
          final_label: "Unknown",
          confidence: 0,
          explanation: "AI classifiers unavailable; manual review required",
          detectors_unavailable: true
      };
  }
}
