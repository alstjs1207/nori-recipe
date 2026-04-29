import { CHILD_REACTION_OPTIONS, type ChildReaction } from "@/constants/feedback";
import { randomUUID } from "expo-crypto";

import type { DevArea } from "@/constants/devAreas";
import { initializeDatabase } from "@/db";
import { loadPlaysBundle } from "@/data/content";
import type {
  AreaScoreMap,
  DevAreaStat,
  FavoriteRecord,
  PlayLogRecord,
  UserContext,
} from "@/types";
import { DEFAULT_USER_CONTEXT } from "@/types";

type UserContextRow = {
  child_birth_month: number | null;
  owned_materials: string;
  blocked_materials: string;
  preferred_dev_areas: string;
  dev_gaps: string;
  user_feedback: string;
};

const playIndex = new Map(loadPlaysBundle().plays.map((play) => [play.id, play]));

function parseStringArray<T extends string>(value: string | null | undefined): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseScoreMap(value: string | null | undefined): AreaScoreMap {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [DevArea, number] => typeof entry[1] === "number")
        .map(([key, score]) => [key, clampScore(score)]),
    );
  } catch {
    return {};
  }
}

function parseChildReactions(value: string | null | undefined): ChildReaction[] {
  const options = new Set<string>(CHILD_REACTION_OPTIONS);

  return parseStringArray<string>(value).filter(
    (reaction): reaction is ChildReaction => options.has(reaction),
  );
}

function serializeChildReactions(reactions: ChildReaction[] | null | undefined): string | null {
  if (!reactions || reactions.length === 0) {
    return null;
  }

  return JSON.stringify(reactions);
}

function normalizeUserContext(row?: UserContextRow | null): UserContext {
  if (!row) {
    return DEFAULT_USER_CONTEXT;
  }

  return {
    childBirthMonth: row.child_birth_month,
    ownedMaterials: parseStringArray(row.owned_materials),
    blockedMaterials: parseStringArray(row.blocked_materials),
    preferredDevAreas: parseStringArray(row.preferred_dev_areas),
    devGaps: parseScoreMap(row.dev_gaps),
    userFeedback: parseScoreMap(row.user_feedback),
  };
}

function getMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function adjustAreaScores(
  currentScores: AreaScoreMap,
  devAreas: DevArea[],
  delta: number,
): AreaScoreMap {
  if (delta === 0 || devAreas.length === 0) {
    return currentScores;
  }

  const nextScores = { ...currentScores };

  for (const devArea of devAreas) {
    nextScores[devArea] = clampScore((nextScores[devArea] ?? 50) + delta);
  }

  return nextScores;
}

export async function insertPlayLog(
  guestId: string,
  playId: string,
  rating: number | null,
  reactions: ChildReaction[] | null,
  memo: string | null,
  durationActual: number | null = null,
): Promise<string> {
  const play = playIndex.get(playId);

  if (!play) {
    throw new Error(`Unknown play id: ${playId}`);
  }

  const database = await initializeDatabase();
  const playLogId = randomUUID();
  const completedAt = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO play_logs (
        id, guest_id, play_id, completed_at, duration_actual, star_rating, child_reaction, memo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      playLogId,
      guestId,
      playId,
      completedAt,
      durationActual,
      rating,
      serializeChildReactions(reactions),
      memo,
    );

    for (const devArea of play.devAreas) {
      await database.runAsync(
        `INSERT INTO dev_logs (id, guest_id, dev_area, play_id, logged_at)
         VALUES (?, ?, ?, ?, ?)`,
        randomUUID(),
        guestId,
        devArea,
        playId,
        completedAt,
      );
    }
  });

  return playLogId;
}

export async function getPlayLogs(guestId: string, limit = 20): Promise<PlayLogRecord[]> {
  const database = await initializeDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    guest_id: string;
    play_id: string;
    completed_at: string;
    duration_actual: number | null;
    star_rating: number | null;
    child_reaction: string | null;
    memo: string | null;
  }>(
    `SELECT id, guest_id, play_id, completed_at, duration_actual, star_rating, child_reaction, memo
     FROM play_logs
     WHERE guest_id = ?
     ORDER BY completed_at DESC
     LIMIT ?`,
    guestId,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    guestId: row.guest_id,
    playId: row.play_id,
    completedAt: row.completed_at,
    durationActual: row.duration_actual,
    starRating: row.star_rating,
    childReaction: parseChildReactions(row.child_reaction),
    memo: row.memo,
  }));
}

export async function getLatestPlayLog(
  guestId: string,
  playId: string,
): Promise<PlayLogRecord | null> {
  const database = await initializeDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    guest_id: string;
    play_id: string;
    completed_at: string;
    duration_actual: number | null;
    star_rating: number | null;
    child_reaction: string | null;
    memo: string | null;
  }>(
    `SELECT id, guest_id, play_id, completed_at, duration_actual, star_rating, child_reaction, memo
     FROM play_logs
     WHERE guest_id = ? AND play_id = ?
     ORDER BY completed_at DESC
     LIMIT 1`,
    guestId,
    playId,
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    guestId: row.guest_id,
    playId: row.play_id,
    completedAt: row.completed_at,
    durationActual: row.duration_actual,
    starRating: row.star_rating,
    childReaction: parseChildReactions(row.child_reaction),
    memo: row.memo,
  };
}

export async function getPlayLogCount(guestId: string): Promise<number> {
  const database = await initializeDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM play_logs WHERE guest_id = ?",
    guestId,
  );

  return row?.total ?? 0;
}

export async function getFavorites(guestId: string, limit = 8): Promise<FavoriteRecord[]> {
  const database = await initializeDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    guest_id: string;
    play_id: string;
    created_at: string;
  }>(
    `SELECT id, guest_id, play_id, created_at
     FROM favorites
     WHERE guest_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    guestId,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    guestId: row.guest_id,
    playId: row.play_id,
    createdAt: row.created_at,
  }));
}

export async function toggleFavorite(guestId: string, playId: string): Promise<boolean> {
  const database = await initializeDatabase();
  const existingFavorite = await database.getFirstAsync<FavoriteRecord>(
    "SELECT id, guest_id AS guestId, play_id AS playId, created_at AS createdAt FROM favorites WHERE guest_id = ? AND play_id = ?",
    guestId,
    playId,
  );

  if (existingFavorite) {
    await database.runAsync("DELETE FROM favorites WHERE id = ?", existingFavorite.id);
    return false;
  }

  await database.runAsync(
    "INSERT INTO favorites (id, guest_id, play_id, created_at) VALUES (?, ?, ?, ?)",
    randomUUID(),
    guestId,
    playId,
    new Date().toISOString(),
  );

  return true;
}

export async function isFavorite(guestId: string, playId: string): Promise<boolean> {
  const database = await initializeDatabase();
  const row = await database.getFirstAsync<{ id: string }>(
    "SELECT id FROM favorites WHERE guest_id = ? AND play_id = ? LIMIT 1",
    guestId,
    playId,
  );
  return Boolean(row);
}

export async function getUserContext(guestId: string): Promise<UserContext> {
  const database = await initializeDatabase();
  const row = await database.getFirstAsync<UserContextRow>(
    `SELECT
       child_birth_month,
       owned_materials,
       blocked_materials,
       preferred_dev_areas,
       dev_gaps,
       user_feedback
     FROM user_context
     WHERE guest_id = ?
     LIMIT 1`,
    guestId,
  );

  return normalizeUserContext(row);
}

export async function upsertUserContext(guestId: string, context: UserContext): Promise<UserContext> {
  const database = await initializeDatabase();

  await database.runAsync(
    `INSERT INTO user_context (
      guest_id,
      child_birth_month,
      owned_materials,
      blocked_materials,
      preferred_dev_areas,
      dev_gaps,
      user_feedback,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id) DO UPDATE SET
      child_birth_month = excluded.child_birth_month,
      owned_materials = excluded.owned_materials,
      blocked_materials = excluded.blocked_materials,
      preferred_dev_areas = excluded.preferred_dev_areas,
      dev_gaps = excluded.dev_gaps,
      user_feedback = excluded.user_feedback,
      updated_at = excluded.updated_at`,
    guestId,
    context.childBirthMonth,
    JSON.stringify(context.ownedMaterials),
    JSON.stringify(context.blockedMaterials),
    JSON.stringify(context.preferredDevAreas),
    JSON.stringify(context.devGaps),
    JSON.stringify(context.userFeedback),
    new Date().toISOString(),
  );

  return getUserContext(guestId);
}

export async function applyPlayFeedbackSignals(
  guestId: string,
  playId: string,
  rating: number | null,
  reactions: ChildReaction[],
): Promise<UserContext> {
  const play = playIndex.get(playId);

  if (!play) {
    throw new Error(`Unknown play id: ${playId}`);
  }

  const currentContext = await getUserContext(guestId);
  let userFeedback = currentContext.userFeedback;
  let devGaps = currentContext.devGaps;

  if (typeof rating === "number") {
    if (rating >= 4) {
      userFeedback = adjustAreaScores(userFeedback, play.devAreas, 10);
    } else if (rating <= 2) {
      userFeedback = adjustAreaScores(userFeedback, play.devAreas, -15);
    }
  }

  if (reactions.includes("더 하고 싶어했어요")) {
    devGaps = adjustAreaScores(devGaps, play.devAreas, -10);
  }

  return upsertUserContext(guestId, {
    ...currentContext,
    devGaps,
    userFeedback,
  });
}

export async function resetUserActivity(guestId: string): Promise<UserContext> {
  const database = await initializeDatabase();
  const currentContext = await getUserContext(guestId);
  const nextContext: UserContext = {
    ...currentContext,
    devGaps: {},
    userFeedback: {},
  };

  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM play_logs WHERE guest_id = ?", guestId);
    await database.runAsync("DELETE FROM dev_logs WHERE guest_id = ?", guestId);
    await database.runAsync("DELETE FROM favorites WHERE guest_id = ?", guestId);
    await database.runAsync(
      `UPDATE user_context
       SET dev_gaps = ?, user_feedback = ?, updated_at = ?
       WHERE guest_id = ?`,
      JSON.stringify(nextContext.devGaps),
      JSON.stringify(nextContext.userFeedback),
      new Date().toISOString(),
      guestId,
    );
  });

  return getUserContext(guestId);
}

export async function getDevAreaStats(
  guestId: string,
  year: number,
  month: number,
): Promise<DevAreaStat[]> {
  const database = await initializeDatabase();
  const { start, end } = getMonthBounds(year, month);
  const rows = await database.getAllAsync<{ dev_area: DevArea; total: number }>(
    `SELECT dev_area, COUNT(*) AS total
     FROM dev_logs
     WHERE guest_id = ? AND logged_at >= ? AND logged_at < ?
     GROUP BY dev_area
     ORDER BY total DESC, dev_area ASC`,
    guestId,
    start,
    end,
  );

  return rows.map((row) => ({
    devArea: row.dev_area,
    total: row.total,
  }));
}
