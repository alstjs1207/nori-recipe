export const DATABASE_NAME = "nori-recipe.db";
export const DATABASE_VERSION = 2;

export const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS play_logs (
        id TEXT PRIMARY KEY NOT NULL,
        guest_id TEXT NOT NULL,
        play_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_actual INTEGER,
        star_rating INTEGER,
        child_reaction TEXT,
        memo TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_play_logs_guest_completed_at
        ON play_logs (guest_id, completed_at DESC);

      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY NOT NULL,
        guest_id TEXT NOT NULL,
        play_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(guest_id, play_id)
      );

      CREATE INDEX IF NOT EXISTS idx_favorites_guest_created_at
        ON favorites (guest_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS user_context (
        guest_id TEXT PRIMARY KEY NOT NULL,
        child_birth_month INTEGER,
        owned_materials TEXT NOT NULL DEFAULT '[]',
        blocked_materials TEXT NOT NULL DEFAULT '[]',
        preferred_dev_areas TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dev_logs (
        id TEXT PRIMARY KEY NOT NULL,
        guest_id TEXT NOT NULL,
        dev_area TEXT NOT NULL,
        play_id TEXT NOT NULL,
        logged_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dev_logs_guest_logged_at
        ON dev_logs (guest_id, logged_at DESC);

      CREATE INDEX IF NOT EXISTS idx_dev_logs_guest_dev_area
        ON dev_logs (guest_id, dev_area);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE user_context ADD COLUMN dev_gaps TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE user_context ADD COLUMN user_feedback TEXT NOT NULL DEFAULT '{}';
    `,
  },
] as const;
