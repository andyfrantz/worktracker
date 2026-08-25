/** Minimal persisted settings and metadata records kept outside domain types. */

export interface SettingRecord {
  key: string;
  value: string;
}

export interface MetaRecord {
  key: string;
  value: string;
}
