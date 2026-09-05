import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userProfiles } from '../db/schema.js';

const router = Router();

// POST /api/v1/profile
router.post('/', async (req, res) => {
  try {
    const { userId, fullName, email, phone, location, company, role } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Upsert profile
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userProfiles)
        .set({
          full_name: fullName,
          email,
          phone,
          location,
          company,
          role,
          updated_at: new Date(),
        })
        .where(eq(userProfiles.user_id, userId));
    } else {
      await db.insert(userProfiles).values({
        user_id: userId,
        full_name: fullName,
        email,
        phone,
        location,
        company,
        role,
      });
    }

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/v1/profile/:userId
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    return res.json({ success: true, result: profile });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
