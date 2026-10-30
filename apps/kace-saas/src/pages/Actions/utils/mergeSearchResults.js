/**
 * Merges several `genericSearch` result pages into a single de-duplicated list and
 * caps it to `limit` entries.
 *
 * The merge uses **round-robin interleaving** across the input pages so that, when
 * one field (e.g. `nombres`) returns more matches than the other fields (e.g.
 * `apellido1`, `apellido2`), the result page is not biased towards that single
 * field. Each "round" pulls the first unseen item from every page in order; the
 * process repeats until `limit` items are collected or every page is exhausted.
 *
 * Items without an `id` (or any value the `getId` mapper rejects) are skipped, so
 * they neither count towards the limit nor block the merge.
 *
 * Extracted as a pure function so the rule-builder search callback stays thin and
 * this logic can be unit tested without mocking the network layer or React.
 *
 * @param {Array<{ data?: Array<Record<string, unknown>> } | null | undefined>} results
 * @param {number} limit
 * @param {{ getId?: (item: Record<string, unknown>) => unknown }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export const mergeAndLimitResults = (results = [], limit, { getId = (item) => item?.id } = {}) => {
    const queues = results.map((result) => (result?.data ?? []).slice());
    const seen = new Set();
    const merged = [];
    const hasLimit = Number.isFinite(limit);

    while (!hasLimit || merged.length < limit) {
        let progressed = false;
        for (const queue of queues) {
            while (queue.length > 0) {
                const item = queue.shift();
                const id = getId(item);
                if (id == null || seen.has(id)) continue;
                seen.add(id);
                merged.push(item);
                progressed = true;
                break;
            }
            if (hasLimit && merged.length >= limit) break;
        }
        if (!progressed) break;
    }

    return hasLimit ? merged.slice(0, limit) : merged;
};
