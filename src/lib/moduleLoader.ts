/** Share speculative and navigation imports; allow a retry after a failed fetch. */
export function moduleLoader<T>(
  importModule: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= importModule().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
