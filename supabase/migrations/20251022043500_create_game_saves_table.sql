/*
  # Create game saves table

  1. New Tables
    - `game_saves`
      - `id` (uuid, primary key) - Unique identifier for each save
      - `game_state` (jsonb) - Stores the complete game state including gold, wave, score, towers, and lives
      - `created_at` (timestamptz) - Timestamp when the save was created
      - `updated_at` (timestamptz) - Timestamp when the save was last updated

  2. Security
    - Enable RLS on `game_saves` table
    - Add policy for anyone to read saves (public game, no auth required)
    - Add policy for anyone to insert saves (public game, no auth required)

  3. Important Notes
    - This is a simplified approach for a public game without authentication
    - In production, you would want to add user authentication and restrict access
    - The game_state column uses JSONB for flexible storage of game data
*/

CREATE TABLE IF NOT EXISTS game_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_state jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game saves"
  ON game_saves
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert game saves"
  ON game_saves
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_game_saves_created_at ON game_saves(created_at DESC);
