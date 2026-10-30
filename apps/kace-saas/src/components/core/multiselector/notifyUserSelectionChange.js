export function notifyUserSelectionChange(setListValues, onUserSelectionChange, next, currentList) {
    setListValues(next);
    const resolved = typeof next === "function" ? next(currentList) : next;
    onUserSelectionChange?.(resolved);
}
