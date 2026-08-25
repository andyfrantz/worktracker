import { db, initializeDatabase, seedFirstRunData } from '../db';

export async function initializeApp(): Promise<void> {
  await initializeDatabase(db);
  await seedFirstRunData(db);
}
