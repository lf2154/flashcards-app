/** 產生唯一 ID（備份還原與日後同步都不會衝突） */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // 極舊的瀏覽器退而求其次
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}
