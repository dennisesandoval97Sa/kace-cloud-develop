/**
 * Picks which schedulers a process runs based on its WORKER_MODE.
 *
 * `fast` → the per-minute jobs only; `ans` → the heavy SLA recalculation plus the backlog recount;
 * `all` → every scheduler (local/dev). Keeping AnsCalculateJob out of the `fast` process is the
 * whole point of the split: its synchronous, multi-minute SLA recalculation can no longer
 * freeze the fast worker's event loop (or its /health probe) and trigger ECS health-check
 * restarts. When it freezes now, only its own isolated task is affected.
 *
 * @param {'fast'|'ans'|'all'} mode
 * @param {{ fast: any, ans: any, backlog: any }} schedulers
 * @returns {Array<any>} the schedulers to start for this process
 */
export const resolveActiveSchedulers = (mode, { fast, ans, backlog }) => {
    switch (mode) {
        case 'fast':
            return [fast];
        case 'ans':
            return [ans, backlog];
        case 'all':
            return [fast, ans, backlog];
        default:
            throw new Error(`unknown worker mode: ${mode}`);
    }
};
