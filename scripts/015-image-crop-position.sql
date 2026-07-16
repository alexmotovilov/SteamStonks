-- Migration 015: Add header_image_position to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS header_image_position TEXT DEFAULT '50% 50%';
