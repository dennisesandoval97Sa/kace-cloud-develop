const KACE_SESSION_UNLOAD_BYPASS = "__kaceSessionUnloadBypass";

export function armUnloadBypassForForcedSessionEnd() {
    window[KACE_SESSION_UNLOAD_BYPASS] = true;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            delete window[KACE_SESSION_UNLOAD_BYPASS];
        });
    });
}

export function isUnloadBypassArmedForForcedSessionEnd() {
    return Boolean(window[KACE_SESSION_UNLOAD_BYPASS]);
}
