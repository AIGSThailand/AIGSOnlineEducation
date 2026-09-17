/** Drain newer edits serially; an earlier response must never acknowledge a later draft. */
export async function saveLatest<T extends { success: boolean }>(
  snapshot: () => string,
  save: () => Promise<T>
): Promise<T> {
  while (true) {
    const before = snapshot();
    const result = await save();
    if (!result.success || snapshot() === before) return result;
  }
}
