import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { AutomatedAssignmentRunResponse } from '../AutomatedAssignmentRunResponse.js';

export class AutomatedAssignmentRunFinder {
    /** @type {import('../../infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js').KnexAutomatedAssignmentRunsRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id
     * @return {Promise<AutomatedAssignmentRunResponse>}
     */
    async execute(id) {
        const run = await this.#repository.find(new ValueObjectUuid('id', id));
        if (!run || run.isDeleted()) {
            throw new ValidationFailError('AutomatedAssignmentRun not found');
        }
        await this.#attachGroupNames(run);
        return new AutomatedAssignmentRunResponse(run);
    }

    /**
     * El snapshot solo persiste ids (los nombres pueden cambiar después del ciclo);
     * se resuelven al leer el detalle para que la UI no muestre UUIDs.
     */
    async #attachGroupNames(run) {
        const groups = run.capacity_snapshot.value?.groups;
        if (!groups || groups.length === 0) return;

        const userIds = groups.flatMap((group) => (group.available_users ?? []).map((user) => String(user.usuario_id)));
        const [groupNames, userNames] = await Promise.all([
            this.#repository.findGroupNames(groups.map((group) => group.grupo_id)),
            this.#repository.findUserNames([...new Set(userIds)]),
        ]);

        for (const group of groups) {
            group.nombre = groupNames.get(String(group.grupo_id)) ?? null;
            for (const user of group.available_users ?? []) {
                user.nombre = userNames.get(String(user.usuario_id)) ?? null;
            }
        }
    }
}
