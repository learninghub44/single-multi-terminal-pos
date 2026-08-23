-- First Admin Bootstrap + Staff Invites Migration
-- Run this AFTER migration_atomic_sale.sql
--
-- What this adds:
--   1. A way to create the very first admin account. Previously POST
--      /api/users required an existing owner to be logged in already
--      (a chicken-and-egg problem for a brand new deployment - there was
--      no way to create the first user at all through the app).
--   2. A staff invite system: an owner or manager generates a one-time
--      link, sends it to a new staff member (WhatsApp, SMS, however), and
--      that person sets their own name/email/password to create their own
--      account - no one has to type someone else's password for them, and
--      the owner doesn't need to be present when the staff member signs up.

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);
