const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function parseRecentProductIds(value: string | null, limit = 8): string[] {
  if (!value || !Number.isInteger(limit) || limit < 1) return [];
  const seen = new Set<string>();
  for (const rawId of value.split(",")) {
    const id = rawId.trim().toLowerCase();
    if (OBJECT_ID_PATTERN.test(id)) seen.add(id);
    if (seen.size >= Math.min(limit, 8)) break;
  }
  return [...seen];
}
