export const DATABASE_NAME = "nori-recipe.db";
export const DATABASE_VERSION = 3;

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
  {
    // v3: 향후 계정 연동/서버 동기화를 위한 메타데이터.
    //  - updated_at: 충돌 해소(LWW) 기준 시각. 기존 행은 원본 타임스탬프로 백필.
    //  - deleted_at: tombstone(소프트 삭제). NULL = 미삭제. 삭제 전파를 위해 hard delete 대신 사용.
    //  - sync_state: 'pending'(로컬 변경, 미동기화) | 'synced'. 서버 도입 전에는 모두 'pending'.
    version: 3,
    sql: `
      ALTER TABLE play_logs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE play_logs ADD COLUMN deleted_at TEXT;
      ALTER TABLE play_logs ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending';
      UPDATE play_logs SET updated_at = completed_at WHERE updated_at = '';

      ALTER TABLE favorites ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE favorites ADD COLUMN deleted_at TEXT;
      ALTER TABLE favorites ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending';
      UPDATE favorites SET updated_at = created_at WHERE updated_at = '';

      ALTER TABLE dev_logs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE dev_logs ADD COLUMN deleted_at TEXT;
      ALTER TABLE dev_logs ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending';
      UPDATE dev_logs SET updated_at = logged_at WHERE updated_at = '';

      ALTER TABLE user_context ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending';

      CREATE INDEX IF NOT EXISTS idx_play_logs_guest_active
        ON play_logs (guest_id, completed_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_favorites_guest_active
        ON favorites (guest_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_dev_logs_guest_active
        ON dev_logs (guest_id, logged_at DESC) WHERE deleted_at IS NULL;
    `,
  },
] as const;
