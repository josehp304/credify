import express from 'express';
import { db } from '../db/index.js';
import { verificationLogs, trustProfiles } from '../db/schema.js';
import { sql, desc } from 'drizzle-orm';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [totalOpsResult] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(verificationLogs);
    const totalOperations = totalOpsResult?.count || 0;

    const [fraudResult] = await db.select({ count: sql`count(*)`.mapWith(Number) })
      .from(verificationLogs)
      .where(sql`result_status IN ('FAIL', 'FLAGGED', 'FLAG')`);
    const fraudStopped = fraudResult?.count || 0;

    const [avgScoreResult] = await db.select({ avg: sql`avg(trust_score)`.mapWith(Number) }).from(trustProfiles);
    const avgTrustScore = avgScoreResult?.avg ? Math.round(avgScoreResult.avg) : 82;

    res.json({
      success: true,
      stats: {
        totalOperations,
        fraudStopped,
        avgTrustScore
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const recentLogs = await db.select()
      .from(verificationLogs)
      .orderBy(desc(verificationLogs.created_at))
      .limit(5);

    res.json({ success: true, result: recentLogs });
  } catch (error) {
    console.error('Recent error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent logs' });
  }
});

export default router;
