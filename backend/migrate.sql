-- Add new columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_number VARCHAR(10);
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create index for faster attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance(player_id);

-- Create composite index for unique attendance per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_attendance ON attendance(player_id, attendance_date);