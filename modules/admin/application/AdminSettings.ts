export type AdminSettingInput = Readonly<{ key: string; value: unknown; sensitive?: boolean }>;
export type SettingsRepository = { list(): Promise<unknown[]>; save(input: AdminSettingInput, adminUserId: string): Promise<boolean> };

const MAX_KEY_LENGTH = 128;
const MAX_JSON_LENGTH = 50_000;
const MAX_DEPTH = 8;
const MAX_OBJECT_KEYS = 100;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_LENGTH = 4_096;

function validateJsonValue(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new Error("INVALID_SETTING");
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && value.length > MAX_STRING_LENGTH) throw new Error("INVALID_SETTING");
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("INVALID_SETTING");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) throw new Error("INVALID_SETTING");
    for (const item of value) validateJsonValue(item, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_OBJECT_KEYS) throw new Error("INVALID_SETTING");
    for (const [key, item] of entries) {
      if (!key || key.length > MAX_KEY_LENGTH || key.includes("\0")) throw new Error("INVALID_SETTING");
      validateJsonValue(item, depth + 1);
    }
    return;
  }
  throw new Error("INVALID_SETTING");
}

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_SETTING");
  const key = value.trim().toLowerCase();
  if (key.length < 2 || key.length > MAX_KEY_LENGTH || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(key)) throw new Error("INVALID_SETTING");
  return key;
}

function serializeValidated(value: unknown): string {
  validateJsonValue(value);
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { throw new Error("INVALID_SETTING"); }
  if (serialized === undefined || serialized.length > MAX_JSON_LENGTH) throw new Error("INVALID_SETTING");
  return serialized;
}

export class AdminSettings {
  constructor(private readonly repository: SettingsRepository) {}
  list(): Promise<unknown[]> { return this.repository.list(); }
  save(input: AdminSettingInput, adminUserId: string): Promise<boolean> {
    if (typeof adminUserId !== "string" || !adminUserId.trim()) throw new Error("INVALID_SETTING");
    if (input.sensitive !== undefined && typeof input.sensitive !== "boolean") throw new Error("INVALID_SETTING");
    const key = normalizeKey(input.key);
    const serialized = serializeValidated(input.value);
    return this.repository.save({ key, value: JSON.parse(serialized), sensitive: input.sensitive === true }, adminUserId);
  }
}
