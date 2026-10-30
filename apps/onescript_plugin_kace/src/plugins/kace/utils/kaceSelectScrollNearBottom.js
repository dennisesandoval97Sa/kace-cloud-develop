export function isKaceSelectScrollNearBottom(el, thresholdPx = 48) {
  if (!el) {
    return false;
  }
  if (el.scrollHeight <= el.clientHeight) {
    return false;
  }
  return el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
}
