ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS ladder_red_slot_game_id uuid REFERENCES games(id);
