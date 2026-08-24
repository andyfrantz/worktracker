import Dexie from 'dexie';
import { DB_NAME, DB_VERSION } from './schema';

export class WorkTrackDatabase extends Dexie {
  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({});
  }
}

export const db = new WorkTrackDatabase();
