// レート制限対策（Cloudflare/Groq の per-second 制限を回避）
const BATCH_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    if (i + batchSize < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}
