import { db } from '../db';

export async function initializeApp(): Promise<void> {
  await db.open();
}
