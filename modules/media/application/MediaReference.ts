export function mediaKeyFromUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  const match = normalized.match(/^\/api\/media\/(.+)$/);
  if (!match) return undefined;
  const key = match[1];
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(key)) return undefined;
  return key;
}

export function mediaKeysFromText(value: string): readonly string[] {
  const keys = new Set<string>();
  const pattern = /\/api\/media\/([a-z0-9-]+\/[a-z0-9-]+\.(?:jpg|png|webp))/gi;
  for (const match of value.matchAll(pattern)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys];
}