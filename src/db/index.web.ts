import type { SQLiteDatabase } from "expo-sqlite";

// queries.ts uses AsyncStorage on web. Keep SQLite/WASM out of the web bundle.
export async function getDatabaseAsync(): Promise<SQLiteDatabase> {
  throw new Error("웹 기록은 브라우저 저장소를 사용합니다.");
}

export const initializeDatabase = getDatabaseAsync;
