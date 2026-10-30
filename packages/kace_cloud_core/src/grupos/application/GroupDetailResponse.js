/**
 * Read model of `GET /groups/{id}`. A schedule that no longer exists (or was soft-deleted) is
 * returned as `horario_id: null`, so clients do not have to infer it from an empty description.
 * Only this detail masks it: list and search responses keep the stored `horario_id`.
 */
export class GroupDetailResponse {
    /** @type {Object} is initialized in the constructor */
    #groupData;
    /** @type {import('../../shift-management/domain/ShiftManagement.js').ShiftManagement|null} */
    #schedule;

    /**
     * @param {Object} groupData the `data` of the group's `GroupResponse`
     * @param {import('../../shift-management/domain/ShiftManagement.js').ShiftManagement|null} schedule
     *   the group's schedule, or `null` when it does not exist or was deleted
     */
    constructor(groupData, schedule) {
        this.#groupData = groupData;
        this.#schedule = schedule;
    }

    toJson() {
        const data = this.#groupData;
        const horario_description = this.#schedule?.description.value ?? '';
        return {
            data: { ...data, horario_id: this.#schedule ? data.horario_id : null, horario_description },
            // Deprecated: previous location of the description; remove once no client reads it from here.
            horario_description,
        };
    }
}
