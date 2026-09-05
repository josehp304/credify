import { Router } from 'express';
import { db } from '../db/index.js';
import { trustProfiles, verificationLogs } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const router = Router();

// GET /api/v1/trustcanvas - returns trust profiles + recent logs for canvas visualization
router.get('/', async (req, res) => {
  try {
    const profiles = await db.select().from(trustProfiles).orderBy(desc(trustProfiles.created_at)).limit(50);
    const logs = await db.select().from(verificationLogs).orderBy(desc(verificationLogs.created_at)).limit(200);

    return res.json({ success: true, profiles, logs });
  } catch (err) {
    console.error('Trust canvas error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
