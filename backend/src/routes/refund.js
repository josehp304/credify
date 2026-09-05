import { Router } from 'express';
import multer from 'multer';
import { detectAiGeneratedImage } from '../utils/aiDetection.js';
import { analyzeExif } from '../utils/exifAnalysis.js';
import { db } from '../db/index.js';
import { verificationLogs } from '../db/schema.js';
import { upsertAndScoreTrustProfile } from '../utils/trustProfile.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/refund/verify
router.post('/verify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file required' });
    }

    const { email, phone_number } = req.body;

    // 1. AI Detection (using Gemini Forensics Pipeline)
    const aiResults = await detectAiGeneratedImage(req.file.buffer, req.file.mimetype || 'image/jpeg');
    const aiScore = Math.max(aiResults.artifact_score || 0, aiResults.classifier_score || 0);
    const isAi = (aiResults.final_label || "").includes("AI") || aiScore > 0.5 || aiResults.metadata_detected;

    // 2. EXIF Analysis
    const exifResults = await analyzeExif(req.file.buffer);

    // 3. Determine outcome for trust scoring (before profile upsert)
    let riskLevel = 'LOW';
    let action = 'AUTO_APPROVE';
    let outcome = 'PASS';

    // Give high weightage to AI model results, lower weightage to EXIF analysis
    if (isAi) {
      // AI score > 0.5 immediately results in HIGH risk outright
      riskLevel = 'HIGH';
      action = 'DENY';
      outcome = 'FAIL';
    } else if (aiScore > 0.3 || exifResults.flags.length > 2) {
      // AI score > 0.3 or 3+ EXIF errors triggers a MEDIUM risk. (1-2 EXIF flags ignored)
      riskLevel = 'MEDIUM';
      action = 'FLAG_FOR_REVIEW';
      outcome = 'FLAG';
    }

    // 4. Upsert trust profile and update score based on this request's outcome
    const trustProfile = await upsertAndScoreTrustProfile(db, { email, phone_number }, outcome);
    const trustScore = trustProfile?.trust_score ?? 100;
    const priorFlags = trustProfile?.prior_flags ?? 0;
    const totalChecks = trustProfile?.total_checks ?? 1;

    // Re-evaluate risk taking into account the updated trust score
    if (outcome !== 'FAIL' && trustScore < 50) {
      riskLevel = 'HIGH';
      action = 'DENY';
    } else if (outcome === 'PASS' && trustScore < 80) {
      riskLevel = 'MEDIUM';
      action = 'FLAG_FOR_REVIEW';
    }

    const result = {
      overall_risk: riskLevel,
      recommended_action: action,
      trust_score: trustScore,
      signal_breakdown: {
        ai_forensics: { result: isAi ? 'FAIL' : 'PASS', confidence: Math.round(aiScore * 100) },
        exif_analysis: exifResults,
        trust_score_check: {
          result: trustScore < 80 ? 'FAIL' : 'PASS',
          score: trustScore,
          prior_flags: priorFlags,
          total_checks: totalChecks,
          profile_status: trustProfile ? 'existing' : 'new',
        }
      }
    };

    const [log] = await db.insert(verificationLogs).values({
      endpoint: '/api/v1/refund/verify',
      result_status: isAi ? 'FAIL' : 'PASS',
      details: JSON.stringify(result)
    }).returning();

    return res.json({
      success: true,
      result,
      evidence_report_url: `https://credify.io/reports/${log.id}`
    });

  } catch (err) {
    console.error('Refund verification error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
