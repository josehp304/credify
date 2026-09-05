import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { embedWatermark, extractWatermark } from '../utils/steganography.js';
import { db } from '../db/index.js';
import { watermarkedDocuments, verificationLogs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// POST /api/v1/document/watermark
router.post('/watermark', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Document file required' });

    const { issuer_id, recipient_name, document_type, issue_date, expiry } = req.body;
    const docHash = uuidv4();

    // 1. Embed Watermark (the docHash)
    const modifiedBuffer = await embedWatermark(req.file.buffer, docHash);

    // 2. Save ground truth to DB
    await db.insert(watermarkedDocuments).values({
      doc_hash: docHash,
      issuer_id,
      recipient_name,
      document_type,
      issue_date: new Date(issue_date || Date.now()),
      expiry: expiry ? new Date(expiry) : null
    });

    // 3. Return modified file
    res.setHeader('Content-Type', 'image/png');
    res.send(modifiedBuffer);

  } catch (err) {
    console.error('Document watermarking error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/v1/document/verify
router.post('/verify', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Document file required' });

    const docHash = await extractWatermark(req.file.buffer);

    if (!docHash) {
      return res.json({
        success: true,
        result: { verdict: "UNVERIFIED", reason: "Watermark absent or destroyed by AI-modification" }
      });
    }

    const [docRecord] = await db
      .select()
      .from(watermarkedDocuments)
      .where(eq(watermarkedDocuments.doc_hash, docHash))
      .limit(1);

    if (!docRecord) {
      return res.json({
         success: true,
         result: { verdict: "FRAUD_FLAG", reason: "Watermark exists but does not match any issuance record. Forged DB hash." }
      });
    }

    const [log] = await db.insert(verificationLogs).values({
        endpoint: '/api/v1/document/verify',
        result_status: 'PASS',
        details: `Verified document: ${docRecord.recipient_name}`
    }).returning();

    return res.json({
      success: true,
      result: {
        verdict: "VERIFIED",
        document_data: docRecord
      },
      evidence_report_url: `https://credify.io/reports/${log.id}`
    });

  } catch (err) {
    console.error('Document verification error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
