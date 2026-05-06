import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { DATABASE_NAME, DATABASE_VERSION, MIGRATIONS } from "@/db/schema";

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initializationPromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabaseAsync(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
}

export async function initializeDatabase(): Promise<SQLiteDatabase> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const database = await getDatabaseAsync();

      if (Platform.OS !== "web") {
        await database.execAsync("PRAGMA journal_mode = WAL;");
      }
      await database.execAsync("PRAGMA foreign_keys = ON;");
      await database.execAsync("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);");

      const currentVersionRow = await database.getFirstAsync<{ version: number }>(
        "SELECT version FROM schema_version LIMIT 1",
      );
      const currentVersion = currentVersionRow?.version ?? 0;

      if (currentVersion < DATABASE_VERSION) {
        const runMigrations = async () => {
          for (const migration of MIGRATIONS) {
            if (migration.version <= currentVersion) {
              continue;
            }

            await database.execAsync(migration.sql);
            await database.execAsync(
              `DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (${migration.version});`,
            );
          }
        };

        if (Platform.OS === "web") {
          await runMigrations();
        } else {
          await database.withTransactionAsync(runMigrations);
        }
      }

      return database;
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}
