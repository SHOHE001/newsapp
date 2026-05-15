export async function batchProcess<T>(
  items: T[],
  processor: (batch: T[]) => Promise<unknown>,
  batchSize: number = 20,
): Promise<unknown[]> {
  const results: unknown[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await processor(batch);
    results.push(result);
  }

  return results;
}
