import { DomainAuxCasesFinderByCase } from '../../../aux_casos/index.js';

export default class ParentUpdater {
    /**
     * @type {DomainAuxCasesFinderByCase}
     */
    #auxCaseFinder; // is initialized in the constructor

    /**
     * @type {KnexAuxCasesRepository}
     */
    #auxCaseRepository; // is initialized in the constructor

    /**
     * @param {KnexAuxCasesRepository} auxCaseRepository
     */
    constructor(auxCaseRepository) {
        this.#auxCaseRepository = auxCaseRepository;
        this.#auxCaseFinder = new DomainAuxCasesFinderByCase(auxCaseRepository);
    }

    async execute(caseId, parentId) {
        const childAuxCase = await this.#auxCaseFinder.execute(caseId);
        const childData = childAuxCase?.data?.value;
        if (!childData) {
            return;
        }

        // Set only the child's keys atomically (per-key jsonb_set) instead of
        // reading + overwriting the whole parent blob. A full read-modify-write
        // loses updates when sibling sub-cases are created concurrently, because
        // each writer reads the same baseline and clobbers the others' keys.
        const updates = Object.keys(childData)
            .filter((key) => childData[key] !== undefined)
            .map((key) => ({ path: key, value: childData[key] }));

        if (updates.length === 0) {
            return;
        }

        const parentAuxCase = await this.#auxCaseFinder.execute(parentId);
        if (!parentAuxCase) {
            return;
        }

        await this.#auxCaseRepository.updateDataFields(parentAuxCase.id, parentAuxCase.caso_id.value, updates);
    }
}
