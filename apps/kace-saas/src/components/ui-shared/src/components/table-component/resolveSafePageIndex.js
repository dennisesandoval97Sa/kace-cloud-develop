/**
 * Returns a pageIndex that fits the current row count.
 * When filters shrink the dataset below the active page, jump back to the first page.
 *
 * @param {number} pageIndex
 * @param {number} rowCount
 * @param {number} pageSize
 * @returns {number}
 */
export function resolveSafePageIndex(pageIndex, rowCount, pageSize) {
    const safePageSize = pageSize > 0 ? pageSize : 1;
    const safePageIndex = Number.isFinite(pageIndex) && pageIndex >= 0 ? pageIndex : 0;
    const maxPageIndex = Math.max(0, Math.ceil(Math.max(0, rowCount) / safePageSize) - 1);
    return safePageIndex > maxPageIndex ? 0 : safePageIndex;
}
