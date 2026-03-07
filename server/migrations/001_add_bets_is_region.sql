-- Add is_region to bets (for region vs city payout)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_region BOOLEAN NOT NULL DEFAULT false;
