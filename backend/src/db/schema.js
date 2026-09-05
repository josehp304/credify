import { pgTable, serial, text, integer, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

export const trustProfiles = pgTable('trust_profiles', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  phone_number: varchar('phone_number', { length: 50 }).unique(),
  trust_score: integer('trust_score').notNull().default(100),
  prior_flags: integer('prior_flags').notNull().default(0),
  total_checks: integer('total_checks').notNull().default(0),
  first_seen_at: timestamp('first_seen_at').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const watermarkedDocuments = pgTable('watermarked_documents', {
  id: serial('id').primaryKey(),
  doc_hash: text('doc_hash').notNull().unique(),
  issuer_id: varchar('issuer_id', { length: 255 }).notNull(),
  recipient_name: varchar('recipient_name', { length: 255 }).notNull(),
  document_type: varchar('document_type', { length: 255 }).notNull(),
  issue_date: timestamp('issue_date').notNull(),
  expiry: timestamp('expiry'),
  created_at: timestamp('created_at').defaultNow(),
});

export const physicalIds = pgTable('physical_ids', {
  id: serial('id').primaryKey(),
  signed_token: text('signed_token').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  course: varchar('course', { length: 255 }),
  student_id: varchar('student_id', { length: 50 }).unique(),
  expiry: varchar('expiry', { length: 50 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const verificationLogs = pgTable('verification_logs', {
  id: serial('id').primaryKey(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  request_data: text('request_data'),
  result_status: varchar('result_status', { length: 50 }).notNull(), // PASS, FAIL, FLAG
  details: text('details'),
  created_at: timestamp('created_at').defaultNow(),
});
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull().unique(),
  full_name: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  location: text('location'),
  company: text('company'),
  role: text('role'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
