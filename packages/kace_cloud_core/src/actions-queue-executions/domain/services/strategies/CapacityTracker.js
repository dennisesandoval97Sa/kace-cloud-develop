/**
 * Tracks per-user remaining assignment capacity during a single assignment run.
 * Encapsulates the mutable state so strategy loops stay declarative.
 */
export class CapacityTracker {
    /** @type {Map<string, number>} userId → remaining slots */
    #capacity;

    /**
     * @param {Array<{ id: string, remaining: number }>} users
     */
    constructor(users) {
        this.#capacity = new Map();
        for (const { id, remaining } of users) {
            this.#capacity.set(String(id), remaining ?? 1);
        }
    }

    /** @returns {boolean} */
    hasCapacity(userId) {
        return (this.#capacity.get(String(userId)) ?? 0) > 0;
    }

    /**
     * Decrements the remaining capacity for a user by 1.
     * @returns {number} The new remaining value after consumption.
     */
    consume(userId) {
        const key = String(userId);
        const current = this.#capacity.get(key) ?? 0;
        const next = Math.max(0, current - 1);
        this.#capacity.set(key, next);
        return next;
    }

    /** @returns {number} Sum of all remaining slots across all users. */
    totalRemaining() {
        let sum = 0;
        for (const remaining of this.#capacity.values()) {
            sum += remaining;
        }
        return sum;
    }

    /**
     * Returns the first userId that still has remaining capacity.
     * @returns {string|null}
     */
    firstAvailableUserId() {
        for (const [uid, remaining] of this.#capacity.entries()) {
            if (remaining > 0) return uid;
        }
        return null;
    }

    /** @returns {number} The remaining capacity for a specific user. */
    remaining(userId) {
        return this.#capacity.get(String(userId)) ?? 0;
    }
}
