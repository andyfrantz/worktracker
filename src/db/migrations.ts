import type Dexie from 'dexie';
import { DB_VERSION, SCHEMA_V1_STORES } from './schema';

/** Register versioned Dexie schema migrations. */
export function registerMigrations(db: Dexie): void {
  db.version(DB_VERSION).stores(SCHEMA_V1_STORES);
}
