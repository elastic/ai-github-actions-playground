/**
 * Client-side relevance metric computation for the Relevance Eval Harness.
 *
 * All metrics are computed at rank k using binary relevance judgements
 * (a document is either relevant or not).
 */

/**
 * Recall@k: fraction of known-relevant documents found in the top-k results.
 */
export function recallAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  if (relevantIds.length === 0) return 0;
  const relevantSet = new Set(relevantIds);
  const hits = retrievedIds.slice(0, k).filter((id) => relevantSet.has(id)).length;
  return hits / relevantIds.length;
}

/**
 * Precision@k: fraction of the top-k results that are relevant.
 */
export function precisionAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  if (k === 0) return 0;
  const relevantSet = new Set(relevantIds);
  const hits = retrievedIds.slice(0, k).filter((id) => relevantSet.has(id)).length;
  return hits / k;
}

/**
 * NDCG@k: Normalised Discounted Cumulative Gain at rank k.
 * Uses binary relevance (gain = 1 if relevant, 0 otherwise).
 */
export function ndcgAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  const relevantSet = new Set(relevantIds);
  const topK = retrievedIds.slice(0, k);

  let dcg = 0;
  for (const [i, id] of topK.entries()) {
    if (relevantSet.has(id)) {
      dcg += 1 / Math.log2(i + 2);
    }
  }

  const idealHits = Math.min(relevantIds.length, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}
