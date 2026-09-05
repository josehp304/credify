import { eq, or } from 'drizzle-orm';
import { trustProfiles } from '../db/schema.js';

/**
 * Upsert a trust profile and update the score based on the analysis outcome.
 *
 * @param {import('drizzle-orm/node-postgres').NodePgDatabase} db
 * @param {{ email?: string, phone_number?: string }} identity
 * @param {'PASS' | 'FLAG' | 'FAIL'} outcome  - Result of this request's analysis
 * @returns {Promise<typeof trustProfiles.$inferSelect>}  The updated/created trust profile
 */
export async function upsertAndScoreTrustProfile(db, { email, phone_number }, outcome) {
  if (!email && !phone_number) return null;

  // Score deltas per outcome
  const DELTA = { PASS: 3, FLAG: -5, FAIL: -15 };
  const delta = DELTA[outcome] ?? 0;
  const isFail = outcome === 'FAIL';

  // Build lookup condition
  const conditions = [];
  if (email)        conditions.push(eq(trustProfiles.email, email));
  if (phone_number) conditions.push(eq(trustProfiles.phone_number, phone_number));

  const [existing] = await db
    .select()
    .from(trustProfiles)
    .where(or(...conditions))
    .limit(1);

  if (!existing) {
    // --- New user: create a cautious starting profile ---
    const initialScore = 80;
    const [created] = await db
      .insert(trustProfiles)
      .values({
        email:        email        ?? null,
        phone_number: phone_number ?? null,
        trust_score:  Math.min(100, Math.max(0, initialScore + delta)),
        prior_flags:  isFail ? 1 : 0,
        total_checks: 1,
      })
      .returning();
    return created;
  }

  // --- Existing user: update score and counters ---
  const newScore = Math.min(100, Math.max(0, existing.trust_score + delta));
  const [updated] = await db
    .update(trustProfiles)
    .set({
      trust_score:  newScore,
      prior_flags:  isFail ? existing.prior_flags + 1 : existing.prior_flags,
      total_checks: existing.total_checks + 1,
      updated_at:   new Date(),
    })
    .where(eq(trustProfiles.id, existing.id))
    .returning();

  return updated;
}
