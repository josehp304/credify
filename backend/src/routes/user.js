import { Router } from 'express';
import { eq, or, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trustProfiles, verificationLogs } from '../db/schema.js';

const router = Router();

// GET /api/v1/user/trust-score
router.get('/trust-score', async (req, res) => {
  try {
    const { email, phone_number } = req.query;
    
    if (!email && !phone_number) {
      return res.status(400).json({ success: false, error: 'Must provide email or phone_number query parameter' });
    }

    const conditions = [];
    if (email) conditions.push(eq(trustProfiles.email, email));
    if (phone_number) conditions.push(eq(trustProfiles.phone_number, phone_number));

    const [user] = await db
      .select()
      .from(trustProfiles)
      .where(or(...conditions))
      .limit(1);

    if (!user) {
      return res.json({
        success: true,
        result: {
          trust_score: 100, // Default for new users
          prior_flags: 0,
          is_new_user: true
        }
      });
    }

    return res.json({
      success: true,
      result: {
        trust_score: user.trust_score,
        prior_flags: user.prior_flags,
        is_new_user: false
      }
    });

  } catch (err) {
    console.error('Trust score lookup error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/v1/user/sync
router.post('/sync', async (req, res) => {
  try {
    const { email, phone_number, fullName } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Must provide email' });
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(trustProfiles)
      .where(eq(trustProfiles.email, email))
      .limit(1);

    if (existingUser) {
      // User exists, just return their data
      return res.json({
        success: true,
        isNew: false,
        user: existingUser
      });
    }

    // Create new user
    const [newUser] = await db.insert(trustProfiles).values({
      email,
      phone_number: phone_number || null, // Ensure phone is either string or null, not undefined
      trust_score: 100,
      prior_flags: 0,
    }).returning();

    return res.json({
      success: true,
      isNew: true,
      user: newUser
    });

  } catch (err) {
    console.error('User sync error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/v1/user/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Total Operations & Fraud Stopped
    const allLogs = await db.select().from(verificationLogs);
    const totalOperations = allLogs.length;
    const fraudStopped = allLogs.filter(log => log.result_status === 'FLAGGED').length;

    // Avg Trust Score
    const profiles = await db.select().from(trustProfiles);
    const avgTrustScore = profiles.length > 0 
      ? Math.round(profiles.reduce((acc, curr) => acc + curr.trust_score, 0) / profiles.length)
      : 0;

    // Recent Operations
    const recent = await db
      .select()
      .from(verificationLogs)
      .orderBy(desc(verificationLogs.created_at))
      .limit(4);

    return res.json({
      success: true,
      stats: {
        totalOperations,
        fraudStopped,
        avgTrustScore
      },
      recent
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
