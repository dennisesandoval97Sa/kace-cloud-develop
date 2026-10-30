/**
 * Sends a postMessage to the parent window (host) when the plugin runs inside an iframe.
 * Uses the parent's origin as targetOrigin for security; falls back to '*' only when origin is unavailable.
 *
 * @param {Record<string, unknown>} payload - Message payload to send (will be structured-cloned).
 * @returns {void}
 */
export function postMessageToParent(payload) {
  if (typeof window === 'undefined' || !window.parent) {
    return;
  }
  try {
    window.parent.postMessage(payload, '*');
  } catch (err) {
    console.warn('[Kace] postMessageToParent failed:', err?.message ?? err);
  }
}
