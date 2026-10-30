let embeddedInKace = false;
let applyTokensHandler = null;
let requestReinitHandler = null;

export function setEmbeddedInKace(value) {
  embeddedInKace = Boolean(value);
}

export function isEmbeddedInKace() {
  return embeddedInKace;
}

export function setApplyTokensFromParent(fn) {
  applyTokensHandler = typeof fn === 'function' ? fn : null;
}

export function applyTokensFromParentPayload(payload) {
  applyTokensHandler?.(payload);
}

export function setRequestReinitFromParent(fn) {
  requestReinitHandler = typeof fn === 'function' ? fn : null;
}

export function requestReinitFromParent() {
  if (!requestReinitHandler) {
    return Promise.reject(new Error('Reinit handler not registered'));
  }
  return requestReinitHandler();
}

export async function waitForValidTokenFromParent({
  isValid,
  timeoutMs = 2000,
  requestReinit,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isValid()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (requestReinit) {
    await requestReinit();
  }
  const reinitDeadline = Date.now() + 5000;
  while (Date.now() < reinitDeadline) {
    if (isValid()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for parent tokens');
}
