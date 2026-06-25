import { CHILD_REACTION_PARSE_OPTIONS, type ChildReaction } from "@/constants/feedback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

import type { DevArea } from "@/constants/devAreas";
import { initializeDatabase } from "@/db";
import { loadPlaysBundle } from "@/data/content";
import type {
  AreaScoreMap,
  DevAreaStat,
  FavoriteRecord,
  PlayLogRecord,
  SyncState,
  UserContext,
} from "@/types";
import { DEFAULT_USER_CONTEXT } from "@/types";

const DEFAULT_SYNC_STATE: SyncState = "pending";

/**
 * 웹(AsyncStorage) 폴백 저장 형태. 네이티브 SQLite 스키마(v3)와 parity를 맞추기 위해
 * 동기화 메타데이터(updatedAt/deletedAt/syncState)를 함께 저장한다.
 * 외부에 반환할 때는 PlayLogRecord/FavoriteRecord 형태로 노출된다(메타데이터는 내부용).
 */
type StoredPlayLog = PlayLogRecord & {
  updatedAt: string;
  deletedAt: string | null;
  syncState: SyncState;
};

type StoredFavorite = FavoriteRecord & {
  updatedAt: string;
  deletedAt: string | null;
  syncState: SyncState;
};

type UserContextRow = {
  child_birth_month: number | null;
  owned_materials: string;
  blocked_materials: string;
  preferred_dev_areas: string;
  dev_gaps: string;
  user_feedback: string;
};

const playIndex = new Map(loadPlaysBundle().plays.map((play) => [play.id, play]));
const WEB_PLAY_LOGS_STORAGE_KEY = "nori-recipe/web-db/play-logs";
const WEB_FAVORITES_STORAGE_KEY = "nori-recipe/web-db/favorites";
const WEB_USER_CONTEXT_STORAGE_KEY = "nori-recipe/web-db/user-context";

function emptyUserContext(): UserContext {
  return {
    childBirthMonth: DEFAULT_USER_CONTEXT.childBirthMonth,
    ownedMaterials: [...DEFAULT_USER_CONTEXT.ownedMaterials],
    blockedMaterials: [...DEFAULT_USER_CONTEXT.blockedMaterials],
    preferredDevAreas: [...DEFAULT_USER_CONTEXT.preferredDevAreas],
    devGaps: { ...DEFAULT_USER_CONTEXT.devGaps },
    userFeedback: { ...DEFAULT_USER_CONTEXT.userFeedback },
  };
}

async function readJsonFromStorage<T>(key: string, fallback: T): Promise<T> {
  const value = await AsyncStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonToStorage(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function parseSyncState(value: unknown): SyncState {
  return value === "synced" ? "synced" : "pending";
}

function normalizeWebPlayLog(value: Partial<StoredPlayLog>): StoredPlayLog | null {
  if (
    typeof value.id !== "string" ||
    typeof value.guestId !== "string" ||
    typeof value.playId !== "string" ||
    typeof value.completedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    guestId: value.guestId,
    playId: value.playId,
    completedAt: value.completedAt,
    durationActual: typeof value.durationActual === "number" ? value.durationActual : null,
    starRating: typeof value.starRating === "number" ? value.starRating : null,
    childReaction: Array.isArray(value.childReaction)
      ? value.childReaction.filter((reaction): reaction is ChildReaction =>
          CHILD_REACTION_PARSE_OPTIONS.includes(reaction as ChildReaction),
        )
      : [],
    memo: typeof value.memo === "string" ? value.memo : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : value.completedAt,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
    syncState: parseSyncState(value.syncState),
  };
}

async function readWebPlayLogs(): Promise<StoredPlayLog[]> {
  const records = await readJsonFromStorage<Partial<StoredPlayLog>[]>(
    WEB_PLAY_LOGS_STORAGE_KEY,
    [],
  );

  return records
    .map(normalizeWebPlayLog)
    .filter((record): record is StoredPlayLog => Boolean(record));
}

async function writeWebPlayLogs(records: StoredPlayLog[]): Promise<void> {
  await writeJsonToStorage(WEB_PLAY_LOGS_STORAGE_KEY, records);
}

function normalizeWebFavorite(value: Partial<StoredFavorite>): StoredFavorite | null {
  if (
    typeof value.id !== "string" ||
    typeof value.guestId !== "string" ||
    typeof value.playId !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    guestId: value.guestId,
    playId: value.playId,
    createdAt: value.createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : value.createdAt,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
    syncState: parseSyncState(value.syncState),
  };
}

async function readWebFavorites(): Promise<StoredFavorite[]> {
  const records = await readJsonFromStorage<Partial<StoredFavorite>[]>(
    WEB_FAVORITES_STORAGE_KEY,
    [],
  );

  return records
    .map(normalizeWebFavorite)
    .filter((record): record is StoredFavorite => Boolean(record));
}

async function writeWebFavorites(records: StoredFavorite[]): Promise<void> {
  await writeJsonToStorage(WEB_FAVORITES_STORAGE_KEY, records);
}

function normalizeWebUserContext(value: Partial<UserContext> | null | undefined): UserContext {
  if (!value || typeof value !== "object") {
    return emptyUserContext();
  }

  return {
    childBirthMonth:
      typeof value.childBirthMonth === "number"
        ? value.childBirthMonth
        : DEFAULT_USER_CONTEXT.childBirthMonth,
    ownedMaterials: Array.isArray(value.ownedMaterials) ? value.ownedMaterials : [],
    blockedMaterials: Array.isArray(value.blockedMaterials) ? value.blockedMaterials : [],
    preferredDevAreas: Array.isArray(value.preferredDevAreas) ? value.preferredDevAreas : [],
    devGaps:
      value.devGaps && typeof value.devGaps === "object"
        ? parseScoreMap(JSON.stringify(value.devGaps))
        : {},
    userFeedback:
      value.userFeedback && typeof value.userFeedback === "object"
        ? parseScoreMap(JSON.stringify(value.userFeedback))
        : {},
  };
}

async function readWebUserContexts(): Promise<Record<string, UserContext>> {
  const records = await readJsonFromStorage<Record<string, Partial<UserContext>>>(
    WEB_USER_CONTEXT_STORAGE_KEY,
    {},
  );

  return Object.fromEntries(
    Object.entries(records).map(([guestId, context]) => [
      guestId,
      normalizeWebUserContext(context),
    ]),
  );
}

async function writeWebUserContexts(records: Record<string, UserContext>): Promise<void> {
  await writeJsonToStorage(WEB_USER_CONTEXT_STORAGE_KEY, records);
}

async function runWriteBatch(
  database: Awaited<ReturnType<typeof initializeDatabase>>,
  task: () => Promise<void>,
) {
  if (Platform.OS === "web") {
    await task();
    return;
  }

  await database.withTransactionAsync(task);
}

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
  const options = new Set<string>(CHILD_REACTION_PARSE_OPTIONS);

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

  const playLogId = randomUUID();
  const completedAt = new Date().toISOString();

  if (Platform.OS === "web") {
    const logs = await readWebPlayLogs();
    await writeWebPlayLogs([
      {
        id: playLogId,
        guestId,
        playId,
        completedAt,
        durationActual,
        starRating: rating,
        childReaction: reactions ?? [],
        memo,
        updatedAt: completedAt,
        deletedAt: null,
        syncState: DEFAULT_SYNC_STATE,
      },
      ...logs,
    ]);

    return playLogId;
  }

  const database = await initializeDatabase();

  await runWriteBatch(database, async () => {
    await database.runAsync(
      `INSERT INTO play_logs (
        id, guest_id, play_id, completed_at, duration_actual, star_rating, child_reaction, memo,
        updated_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      playLogId,
      guestId,
      playId,
      completedAt,
      durationActual,
      rating,
      serializeChildReactions(reactions),
      memo,
      completedAt,
      DEFAULT_SYNC_STATE,
    );

    for (const devArea of play.devAreas) {
      await database.runAsync(
        `INSERT INTO dev_logs (id, guest_id, dev_area, play_id, logged_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        guestId,
        devArea,
        playId,
        completedAt,
        completedAt,
        DEFAULT_SYNC_STATE,
      );
    }
  });

  return playLogId;
}

export async function getPlayLogs(guestId: string, limit = 20): Promise<PlayLogRecord[]> {
  if (Platform.OS === "web") {
    const logs = await readWebPlayLogs();

    return logs
      .filter((log) => log.guestId === guestId && !log.deletedAt)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, limit);
  }

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
     WHERE guest_id = ? AND deleted_at IS NULL
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
  if (Platform.OS === "web") {
    const logs = await readWebPlayLogs();

    return (
      logs
        .filter((log) => log.guestId === guestId && log.playId === playId && !log.deletedAt)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null
    );
  }

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
     WHERE guest_id = ? AND play_id = ? AND deleted_at IS NULL
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
  if (Platform.OS === "web") {
    const logs = await readWebPlayLogs();

    return logs.filter((log) => log.guestId === guestId && !log.deletedAt).length;
  }

  const database = await initializeDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM play_logs WHERE guest_id = ? AND deleted_at IS NULL",
    guestId,
  );

  return row?.total ?? 0;
}

export async function getFavorites(guestId: string, limit = 8): Promise<FavoriteRecord[]> {
  if (Platform.OS === "web") {
    const favorites = await readWebFavorites();

    return favorites
      .filter((favorite) => favorite.guestId === guestId && !favorite.deletedAt)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  const database = await initializeDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    guest_id: string;
    play_id: string;
    created_at: string;
  }>(
    `SELECT id, guest_id, play_id, created_at
     FROM favorites
     WHERE guest_id = ? AND deleted_at IS NULL
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
  const now = new Date().toISOString();

  if (Platform.OS === "web") {
    const favorites = await readWebFavorites();
    const existingFavorite = favorites.find(
      (favorite) => favorite.guestId === guestId && favorite.playId === playId,
    );

    if (existingFavorite && !existingFavorite.deletedAt) {
      // 활성 찜 해제: tombstone으로 소프트 삭제(이력 보존 → 향후 삭제 동기화 가능).
      await writeWebFavorites(
        favorites.map((favorite) =>
          favorite.id === existingFavorite.id
            ? { ...favorite, deletedAt: now, updatedAt: now, syncState: DEFAULT_SYNC_STATE }
            : favorite,
        ),
      );
      return false;
    }

    if (existingFavorite) {
      // 소프트 삭제된 찜 재활성화 (UNIQUE(guest_id, play_id) 재삽입 충돌 방지).
      await writeWebFavorites(
        favorites.map((favorite) =>
          favorite.id === existingFavorite.id
            ? {
                ...favorite,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
                syncState: DEFAULT_SYNC_STATE,
              }
            : favorite,
        ),
      );
      return true;
    }

    await writeWebFavorites([
      {
        id: randomUUID(),
        guestId,
        playId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncState: DEFAULT_SYNC_STATE,
      },
      ...favorites,
    ]);

    return true;
  }

  const database = await initializeDatabase();
  const existingFavorite = await database.getFirstAsync<{ id: string; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM favorites WHERE guest_id = ? AND play_id = ?",
    guestId,
    playId,
  );

  if (existingFavorite && !existingFavorite.deleted_at) {
    // 활성 찜 해제: hard delete 대신 tombstone 처리.
    await database.runAsync(
      "UPDATE favorites SET deleted_at = ?, updated_at = ?, sync_state = ? WHERE id = ?",
      now,
      now,
      DEFAULT_SYNC_STATE,
      existingFavorite.id,
    );
    return false;
  }

  if (existingFavorite) {
    // 소프트 삭제된 찜 재활성화 (UNIQUE(guest_id, play_id) 재삽입 충돌 방지).
    await database.runAsync(
      "UPDATE favorites SET deleted_at = NULL, created_at = ?, updated_at = ?, sync_state = ? WHERE id = ?",
      now,
      now,
      DEFAULT_SYNC_STATE,
      existingFavorite.id,
    );
    return true;
  }

  await database.runAsync(
    "INSERT INTO favorites (id, guest_id, play_id, created_at, updated_at, sync_state) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(),
    guestId,
    playId,
    now,
    now,
    DEFAULT_SYNC_STATE,
  );

  return true;
}

export async function isFavorite(guestId: string, playId: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const favorites = await readWebFavorites();

    return favorites.some(
      (favorite) => favorite.guestId === guestId && favorite.playId === playId && !favorite.deletedAt,
    );
  }

  const database = await initializeDatabase();
  const row = await database.getFirstAsync<{ id: string }>(
    "SELECT id FROM favorites WHERE guest_id = ? AND play_id = ? AND deleted_at IS NULL LIMIT 1",
    guestId,
    playId,
  );
  return Boolean(row);
}

export async function getUserContext(guestId: string): Promise<UserContext> {
  if (Platform.OS === "web") {
    const contexts = await readWebUserContexts();

    return contexts[guestId] ?? emptyUserContext();
  }

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
  if (Platform.OS === "web") {
    const contexts = await readWebUserContexts();
    contexts[guestId] = normalizeWebUserContext(context);
    await writeWebUserContexts(contexts);

    return getUserContext(guestId);
  }

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
      updated_at,
      sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id) DO UPDATE SET
      child_birth_month = excluded.child_birth_month,
      owned_materials = excluded.owned_materials,
      blocked_materials = excluded.blocked_materials,
      preferred_dev_areas = excluded.preferred_dev_areas,
      dev_gaps = excluded.dev_gaps,
      user_feedback = excluded.user_feedback,
      updated_at = excluded.updated_at,
      sync_state = excluded.sync_state`,
    guestId,
    context.childBirthMonth,
    JSON.stringify(context.ownedMaterials),
    JSON.stringify(context.blockedMaterials),
    JSON.stringify(context.preferredDevAreas),
    JSON.stringify(context.devGaps),
    JSON.stringify(context.userFeedback),
    new Date().toISOString(),
    DEFAULT_SYNC_STATE,
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

  if (
    reactions.includes("더 하고 싶어했어요") ||
    reactions.includes("집중했어요") ||
    reactions.includes("스스로 했어요")
  ) {
    devGaps = adjustAreaScores(devGaps, play.devAreas, -10);
  }

  if (reactions.includes("도움이 필요했어요") || reactions.includes("어려워했어요")) {
    devGaps = adjustAreaScores(devGaps, play.devAreas, 10);
  }

  if (reactions.includes("흥미가 적었어요") || reactions.includes("별로였어요")) {
    userFeedback = adjustAreaScores(userFeedback, play.devAreas, -10);
  }

  return upsertUserContext(guestId, {
    ...currentContext,
    devGaps,
    userFeedback,
  });
}

export async function resetUserActivity(guestId: string): Promise<UserContext> {
  const now = new Date().toISOString();

  if (Platform.OS === "web") {
    const [logs, favorites, contexts] = await Promise.all([
      readWebPlayLogs(),
      readWebFavorites(),
      readWebUserContexts(),
    ]);
    const currentContext = contexts[guestId] ?? emptyUserContext();
    const nextContext: UserContext = {
      ...currentContext,
      devGaps: {},
      userFeedback: {},
    };

    // 활동 초기화도 hard delete 대신 tombstone 처리 (삭제 이력 동기화 가능).
    const softDelete = <T extends StoredPlayLog | StoredFavorite>(record: T): T =>
      record.guestId === guestId && !record.deletedAt
        ? { ...record, deletedAt: now, updatedAt: now, syncState: DEFAULT_SYNC_STATE }
        : record;

    contexts[guestId] = nextContext;
    await Promise.all([
      writeWebPlayLogs(logs.map(softDelete)),
      writeWebFavorites(favorites.map(softDelete)),
      writeWebUserContexts(contexts),
    ]);

    return getUserContext(guestId);
  }

  const database = await initializeDatabase();
  const currentContext = await getUserContext(guestId);
  const nextContext: UserContext = {
    ...currentContext,
    devGaps: {},
    userFeedback: {},
  };

  await runWriteBatch(database, async () => {
    await database.runAsync(
      "UPDATE play_logs SET deleted_at = ?, updated_at = ?, sync_state = ? WHERE guest_id = ? AND deleted_at IS NULL",
      now,
      now,
      DEFAULT_SYNC_STATE,
      guestId,
    );
    await database.runAsync(
      "UPDATE dev_logs SET deleted_at = ?, updated_at = ?, sync_state = ? WHERE guest_id = ? AND deleted_at IS NULL",
      now,
      now,
      DEFAULT_SYNC_STATE,
      guestId,
    );
    await database.runAsync(
      "UPDATE favorites SET deleted_at = ?, updated_at = ?, sync_state = ? WHERE guest_id = ? AND deleted_at IS NULL",
      now,
      now,
      DEFAULT_SYNC_STATE,
      guestId,
    );
    await database.runAsync(
      `UPDATE user_context
       SET dev_gaps = ?, user_feedback = ?, updated_at = ?, sync_state = ?
       WHERE guest_id = ?`,
      JSON.stringify(nextContext.devGaps),
      JSON.stringify(nextContext.userFeedback),
      now,
      DEFAULT_SYNC_STATE,
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
  if (Platform.OS === "web") {
    const logs = await readWebPlayLogs();
    const { start, end } = getMonthBounds(year, month);
    const countByDevArea = new Map<DevArea, number>();

    for (const log of logs) {
      if (
        log.guestId !== guestId ||
        log.deletedAt ||
        log.completedAt < start ||
        log.completedAt >= end
      ) {
        continue;
      }

      const play = playIndex.get(log.playId);

      if (!play) {
        continue;
      }

      for (const devArea of play.devAreas) {
        countByDevArea.set(devArea, (countByDevArea.get(devArea) ?? 0) + 1);
      }
    }

    return Array.from(countByDevArea.entries())
      .map(([devArea, total]) => ({ devArea, total }))
      .sort(
        (left, right) => right.total - left.total || left.devArea.localeCompare(right.devArea),
      );
  }

  const database = await initializeDatabase();
  const { start, end } = getMonthBounds(year, month);
  const rows = await database.getAllAsync<{ dev_area: DevArea; total: number }>(
    `SELECT dev_area, COUNT(*) AS total
     FROM dev_logs
     WHERE guest_id = ? AND deleted_at IS NULL AND logged_at >= ? AND logged_at < ?
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
