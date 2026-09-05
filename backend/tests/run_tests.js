/**
 * Credify API Test Suite
 * 
 * Tests all 7 backend endpoints:
 *   1. GET  /api/v1/user/trust-score          (new user lookup)
 *   2. POST /api/v1/review/score              (clean review – PASS)
 *   3. POST /api/v1/review/score              (AI-like review – FAIL, score drop)
 *   4. GET  /api/v1/user/trust-score          (same user, score should have changed)
 *   5. POST /api/v1/refund/verify             (real photo – expect LOW/MEDIUM risk)
 *   6. POST /api/v1/document/watermark        (embed watermark into photo)
 *   7. POST /api/v1/document/verify           (verify the watermarked photo)
 *   8. POST /api/v1/id/verify                 (QR scan on id_for_qr_creation.jpeg)
 *   9. GET  /health                           (server health check)
 * 
 * Usage:
 *   node tests/run_tests.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dir, '../.env') });

const BASE_URL = 'http://localhost:3002';
const TEST_EMAIL = `tester_${Date.now()}@testmail.io`;
const API_KEY = process.env.INTERNAL_API_SECRET || '';

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function log(label, status, body) {
  const icon = status ? '✅' : '❌';
  console.log(`\n${icon}  ${label}`);
  if (!status) {
    failed++;
    console.error('   Response:', JSON.stringify(body, null, 2));
  } else {
    passed++;
    console.log('   Result:', JSON.stringify(body?.result ?? body, null, 2));
  }
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-internal-secret': API_KEY }
  });
  return { status: res.status, body: await res.json() };
}

async function postJSON(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-internal-secret': API_KEY
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function postMultipart(path, fields, fileField, filePath, mimeType = 'image/jpeg') {
  const { FormData, Blob } = await import('node:buffer').catch(() => ({}));

  const formData = new globalThis.FormData();
  for (const [key, val] of Object.entries(fields)) formData.append(key, val);

  const fileBuffer = readFileSync(resolve(__dir, filePath));
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append(fileField, blob, filePath.split('/').pop());

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'x-internal-secret': API_KEY },
    body: formData,
  });

  // document/watermark returns raw image bytes, not JSON
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: null, rawBuffer: buf };
  }

  return { status: res.status, body: await res.json() };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🧪 Credify API Test Suite');
  console.log('━'.repeat(50));
  console.log(`   Base URL : ${BASE_URL}`);
  console.log(`   Test Email: ${TEST_EMAIL}`);
  console.log('━'.repeat(50));

  // ── 1. Health Check ──────────────────────────────────────────────────────────
  {
    const { status, body } = await get('/health');
    log('GET /health — Server is up', status === 200 && body.status === 'ok', body);
  }

  // ── 2. Trust Score – New User (no profile yet) ───────────────────────────────
  {
    const { status, body } = await get(`/api/v1/user/trust-score?email=${TEST_EMAIL}`);
    log(
      'GET /user/trust-score — New user returns default score',
      status === 200 && body.success && body.result.is_new_user === true,
      body,
    );
  }

  // ── 3. Review Score – Clean review (PASS) ────────────────────────────────────
  {
    const { status, body } = await postJSON('/api/v1/review/score', {
      reviewer_email: TEST_EMAIL,
      review_text: 'Absolutely loved the build quality. Arrived on time and works perfectly!',
      platform_id: 'shopify_01',
    });
    log(
      'POST /review/score — Clean review (expect DISPLAY)',
      status === 200 && body.success && body.result.recommendation === 'DISPLAY',
      body,
    );
  }

  // ── 4. Review Score – AI-flagged review (FAIL) ───────────────────────────────
  {
    const { status, body } = await postJSON('/api/v1/review/score', {
      reviewer_email: TEST_EMAIL,
      review_text:
        'In conclusion, this product is a testament to innovation. Let us delve into the rich tapestry of its design.',
      platform_id: 'shopify_01',
    });
    log(
      'POST /review/score — AI review (expect FLAG_FOR_REVIEW or HIDE, score drop)',
      status === 200 && body.success && body.result.recommendation !== 'DISPLAY',
      body,
    );
  }

  // ── 5. Trust Score – Existing user (score should have dropped) ───────────────
  {
    const { status, body } = await get(`/api/v1/user/trust-score?email=${TEST_EMAIL}`);
    const score = body?.result?.trust_score;
    log(
      `GET /user/trust-score — After AI review (score < 83, currently ${score})`,
      status === 200 && body.success && !body.result.is_new_user && score < 83,
      body,
    );
  }

  // ── 6. Refund Verify – Real photo (LOW / MEDIUM risk) ────────────────────────
  {
    const { status, body } = await postMultipart(
      '/api/v1/refund/verify',
      { email: TEST_EMAIL, phone_number: '' },
      'image',
      'johan_joseph.png',
      'image/png',
    );
    log(
      'POST /refund/verify — Real photo (expect LOW or MEDIUM risk)',
      status === 200 && body.success && body.result.overall_risk !== 'CRITICAL',
      body,
    );
  }

  // ── 7. Document Watermark – Embed into photo ────────────────────────────────
  let watermarkedBuffer = null;
  {
    const { status, body, rawBuffer } = await postMultipart(
      '/api/v1/document/watermark',
      {
        issuer_id:      'test_issuer_01',
        recipient_name: 'Johan Joseph',
        document_type:  'Certificate',
        issue_date:     new Date().toISOString(),
      },
      'document',
      'johan_joseph.png',
      'image/png',
    );

    const ok = status === 200 && rawBuffer && rawBuffer.length > 0;
    if (ok) {
      watermarkedBuffer = rawBuffer;
      writeFileSync(resolve(__dir, 'watermarked_output.png'), rawBuffer);
      console.log('\n✅  POST /document/watermark — Watermarked image received');
      console.log(`   Size: ${rawBuffer.length} bytes → saved to tests/watermarked_output.png`);
      passed++;
    } else {
      console.log('\n❌  POST /document/watermark — Failed');
      console.error('   Response:', body);
      failed++;
    }
  }

  // ── 8. Document Verify – Verify the watermarked photo ───────────────────────
  {
    if (!watermarkedBuffer) {
      console.log('\n⚠️   POST /document/verify — Skipped (no watermarked buffer from step 7)');
    } else {
      // Upload the watermarked_output.png we just saved
      const { status, body } = await postMultipart(
        '/api/v1/document/verify',
        {},
        'document',
        'watermarked_output.png',
        'image/png',
      );
      log(
        'POST /document/verify — Watermarked photo returns VERIFIED',
        status === 200 && body.success && body.result.verdict === 'VERIFIED',
        body,
      );
    }
  }

  // ── 9. Document Verify – Unmodified photo (UNVERIFIED) ──────────────────────
  {
    const { status, body } = await postMultipart(
      '/api/v1/document/verify',
      {},
      'document',
      'johan_joseph.png',
      'image/png',
    );
    log(
      'POST /document/verify — Original photo (expect UNVERIFIED)',
      status === 200 && body.success && ['UNVERIFIED', 'FRAUD_FLAG'].includes(body.result.verdict),
      body,
    );
  }

  // ── 10. ID Verify – QR photo ─────────────────────────────────────────────────
  {
    const { status, body } = await postMultipart(
      '/api/v1/id/verify',
      {},
      'image',
      'id_for_qr_creation.jpeg',
      'image/jpeg',
    );
    log(
      'POST /id/verify — ID card photo (QR scan)',
      status === 200 && body.success,
      body,
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '━'.repeat(50));
  console.log(`🏁  Tests complete: ${passed}/${total} passed, ${failed} failed`);
  console.log('━'.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('\n💥 Unexpected test runner error:', err);
  process.exit(1);
});
