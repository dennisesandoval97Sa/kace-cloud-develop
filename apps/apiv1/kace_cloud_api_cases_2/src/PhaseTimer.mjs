export class PhaseTimer {
    #phases = {};
    #startedAt = process.hrtime.bigint();

    start(name) {
        const t0 = process.hrtime.bigint();
        return () => {
            const ms = Number(process.hrtime.bigint() - t0) / 1_000_000;
            this.#phases[name] = (this.#phases[name] ?? 0) + ms;
        };
    }

    summary() {
        const total = Number(process.hrtime.bigint() - this.#startedAt) / 1_000_000;
        return { phases: { ...this.#phases }, total };
    }
}
