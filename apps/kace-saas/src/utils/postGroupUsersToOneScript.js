export function postGroupUsersToOneScript(contentWindow, users, targetOrigin) {
    if (!contentWindow) return;
    contentWindow.postMessage({ type: "kaceGroupUsers", payload: users }, targetOrigin);
}
