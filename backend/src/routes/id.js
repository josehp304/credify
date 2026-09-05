import { Router } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { extractQRCode } from '../utils/qrExtraction.js';
import { db } from '../db/index.js';
import { physicalIds, verificationLogs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/id/generate
router.post('/generate', async (req, res) => {
  try {
    const { name, course, student_id, expiry } = req.body;

    if (!name || !student_id) {
      return res.status(400).json({ success: false, error: 'Name and student_id are required' });
    }

    // Check if user already exists
    let existingRecord = await db.select().from(physicalIds).where(eq(physicalIds.student_id, student_id)).limit(1);
    
    let signedToken;
    let dbRecord;

    if (existingRecord.length > 0) {
      dbRecord = existingRecord[0];
      // Update existing record
      await db.update(physicalIds)
        .set({ name, course, expiry, updated_at: new Date() })
        .where(eq(physicalIds.id, dbRecord.id));
      
      signedToken = dbRecord.signed_token;
    } else {
      // Create new record
      signedToken = uuidv4();
      const [newRecord] = await db.insert(physicalIds).values({
        signed_token: signedToken,
        name,
        course,
        student_id,
        expiry
      }).returning();
      dbRecord = newRecord;
    }

    // Generate QR Code data URI
    const qrUrl = `https://verify.credify.io/id/${signedToken}`;
    const qrCodeDataUri = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
    });

    res.json({
      success: true,
      result: {
        qr_code: qrCodeDataUri,
        signed_token: signedToken,
        record: dbRecord
      }
    });

  } catch (err) {
    console.error('ID generation error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/v1/id/verify
router.post('/verify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Image file required' });

    // 1. Extract QR Code
    const qrData = await extractQRCode(req.file.buffer);
    
    if (!qrData) {
      return res.json({
        success: true,
        result: { verdict: "UNVERIFIED", reason: "No readable QR code found on the ID card." }
      });
    }

    // Expecting QR code format: https://verify.credify.io/id/[signed-token]
    const tokenMatch = qrData.match(/\/id\/([a-zA-Z0-9_-]+)$/);
    const signedToken = tokenMatch ? tokenMatch[1] : qrData;

    // 2. Lookup Ground Truth Data
    const [groundTruth] = await db.select().from(physicalIds).where(eq(physicalIds.signed_token, signedToken)).limit(1);

    if (!groundTruth) {
        return res.json({
            success: true,
            result: { verdict: "FRAUD_FLAG", reason: "Invalid or forged QR token." }
        });
    }

    // 3. Perform Actual OCR via Gemini
    let extractedData = {};
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a forensic document verification agent. Match the OCR text from the provided image against the Ground Truth data.

      GROUND TRUTH (from secure QR):
      - Name: ${groundTruth.name}
      - Course: ${groundTruth.course}
      - Student ID: ${groundTruth.student_id}
      - Expiry/Batch: ${groundTruth.expiry}

      TASK:
      1. Extract the actual text from the ID card.
      2. Compare each field to the Ground Truth.
      3. For 'match' fields, use your judgment: minor formatting differences (e.g., "B.Tech" vs "BTech", "CSE C" vs "cse-c", or case differences) should be marked as MATCH: true.
      4. If the data is fundamentally different (wrong name, wrong ID), mark MATCH: false.

      Return ONLY a valid JSON object:
      {
        "college_name": "extracted college name",
        "name": { "value": "extracted name", "match": true/false },
        "course": { "value": "extracted course", "match": true/false },
        "student_id": { "value": "extracted id", "match": true/false },
        "expiry": { "value": "extracted expiry/batch", "match": true/false }
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: req.file.buffer.toString("base64"),
                  mimeType: req.file.mimetype || "image/jpeg"
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
      extractedData = JSON.parse(response.text || "{}");
    } catch (apiError) {
      console.error("Gemini OCR Error:", apiError);
    }
    
    console.log("OCR Extracted Data:", extractedData); // Logging for debugging

    const ocrResultName = extractedData.name?.value || "UNKNOWN";
    const ocrResultCourse = extractedData.course?.value || "UNKNOWN";
    const ocrResultStudentId = extractedData.student_id?.value || "UNKNOWN";
    const ocrResultExpiry = extractedData.expiry?.value || "UNKNOWN";
    const ocrResultCollege = extractedData.college_name || "UNKNOWN";

    const nameMatch = extractedData.name?.match ?? false;
    const courseMatch = extractedData.course?.match ?? false;
    const studentIdMatch = extractedData.student_id?.match ?? false;
    const expiryMatch = extractedData.expiry?.match ?? false;

    // 4. Comparison
    const checks = [
        { field: 'College Name', gt: 'N/A', ocr: ocrResultCollege, pass: true },
        { field: 'Full Name', gt: groundTruth.name, ocr: ocrResultName, pass: nameMatch },
        { field: 'Course', gt: groundTruth.course, ocr: ocrResultCourse, pass: courseMatch },
        { field: 'Student ID', gt: groundTruth.student_id, ocr: ocrResultStudentId, pass: studentIdMatch }
    ];

    if (groundTruth.expiry) {
        checks.push({ field: 'Expiry Date', gt: groundTruth.expiry, ocr: ocrResultExpiry, pass: expiryMatch });
    } else {
        checks.push({ field: 'Expiry Date', gt: 'N/A', ocr: ocrResultExpiry, pass: true });
    }

    const tamperedFields = checks.filter(c => !c.pass);
    const isMockFraud = tamperedFields.length > 0;

    const [log] = await db.insert(verificationLogs).values({
        endpoint: '/api/v1/id/verify',
        result_status: isMockFraud ? 'FAIL' : 'PASS',
        details: JSON.stringify(checks)
    }).returning();

    return res.json({
        success: true,
        result: {
            verdict: isMockFraud ? "HIGH_FRAUD_PROBABILITY" : "VERIFIED",
            tampered_fields: tamperedFields,
            all_checks: checks
        },
        evidence_report_url: `https://credify.io/reports/${log.id}`
    });

  } catch (err) {
    console.error('ID verification error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
