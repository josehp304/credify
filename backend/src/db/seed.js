import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { db } from './index.js';
import { trustProfiles } from './schema.js';

async function seed() {
  console.log('Seeding trust profiles...');
  const profiles = [
    // Good trust scores
    { email: 'good.user1@example.com', phone_number: '+10000000001', trust_score: 95, prior_flags: 0, total_checks: 10 },
    { email: 'good.user2@example.com', phone_number: '+10000000002', trust_score: 100, prior_flags: 0, total_checks: 5 },
    { email: 'good.user3@example.com', phone_number: '+10000000003', trust_score: 98, prior_flags: 0, total_checks: 15 },
    { email: 'alice.trustworthy@company.com', phone_number: '+10000000004', trust_score: 88, prior_flags: 1, total_checks: 50 },

    // Bad trust scores
    { email: 'bad.actor1@scam.net', phone_number: '+19999999991', trust_score: 15, prior_flags: 12, total_checks: 14 },
    { email: 'refund.scammer@fraud.org', phone_number: '+19999999992', trust_score: 5, prior_flags: 20, total_checks: 21 },
    { email: 'bot.network.x99@bots.com', phone_number: '+19999999993', trust_score: 25, prior_flags: 8, total_checks: 10 },
    { email: 'serial.returner@example.com', phone_number: '+19999999994', trust_score: 42, prior_flags: 5, total_checks: 12 },
  ];

  try {
    for (const p of profiles) {
      // Postgres basic on conflict do nothing behavior:
      await db.insert(trustProfiles).values(p).onConflictDoNothing();
    }
    console.log('Seed complete!');
  } catch (error) {
    console.error('Error seeding DB:', error);
  }
  process.exit(0);
}

seed();