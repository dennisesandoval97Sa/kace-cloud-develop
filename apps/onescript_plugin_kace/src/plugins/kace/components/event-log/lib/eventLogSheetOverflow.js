/**
 * Whether the event-log sheet body can fire scroll events for infinite load.
 * @param {{ scrollHeight?: number, clientHeight?: number } | null | undefined} el
 * @returns {boolean}
 */
export function isSheetScrollable(el) {
  if (el == null) return false;
  return Number(el.scrollHeight) > Number(el.clientHeight);
}

export function getVerticalPadding(el) {
  if (el == null || typeof window === 'undefined') return 0;
  if (typeof window.getComputedStyle !== 'function' || !('tagName' in el)) {
    return 0;
  }
  try {
    const styles = window.getComputedStyle(el);
    return (
      (Number.parseFloat(styles.paddingTop) || 0) +
      (Number.parseFloat(styles.paddingBottom) || 0)
    );
  } catch {
    return 0;
  }
}

export function isSheetContentOverflowing(container, content) {
  if (container == null) return false;
  const contentHeight =
    content == null
      ? Number(container.scrollHeight)
      : Number(content.scrollHeight || content.offsetHeight);
  const availableHeight =
    Number(container.clientHeight) - getVerticalPadding(container);
  return contentHeight > availableHeight;
}

export function isSheetPinnedAtBottom(el, tolerance = 1) {
  if (el == null) return false;
  return (
    Number(el.scrollTop) + Number(el.clientHeight) >=
    Number(el.scrollHeight) - Number(tolerance)
  );
}

/**
 * Fallback control when a further history page exists but the sheet does not
 * overflow, so `onScroll` never reaches the infinite-scroll threshold.
 *
 * @param {object} params
 * @param {boolean} params.hasMore
 * @param {boolean} params.isSheetScrollable
 * @param {boolean} params.isLoading
 * @param {boolean} params.isLoadingMore
 * @param {boolean} params.hasError
 * @returns {boolean}
 */
export function shouldShowLoadMoreButton({
  hasMore,
  isSheetScrollable,
  isLoading,
  isLoadingMore,
  hasError,
}) {
  return (
    Boolean(hasMore) &&
    !isSheetScrollable &&
    !isLoading &&
    !isLoadingMore &&
    !hasError
  );
}

/**
 * Wheel-down fetches the next page only when the sheet has no overflow
 * (`onScroll` never fires). Overflowing sheets stay on native scroll + onScroll.
 *
 * @param {object} params
 * @param {number} params.deltaY
 * @param {boolean} params.isSheetScrollable
 * @param {boolean} params.hasMore
 * @param {boolean} params.isLoading
 * @param {boolean} params.isLoadingMore
 * @param {boolean} params.hasError
 * @returns {boolean}
 */
export function shouldLoadMoreOnWheel({
  deltaY,
  isSheetScrollable,
  hasMore,
  isLoading,
  isLoadingMore,
  hasError,
}) {
  if (!hasMore || isLoading || isLoadingMore || hasError) return false;
  if (!(Number(deltaY) > 0)) return false;
  return !isSheetScrollable;
}
