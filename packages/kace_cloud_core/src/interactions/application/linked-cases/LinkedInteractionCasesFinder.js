import { CustomError } from '../../../shared/index.js';

export class LinkedInteractionCasesFinder {
    #associateRepository;
    #casesRepository;
    #interactionRepository;

    constructor(associateRepository, casesRepository, interactionRepository = null) {
        this.#associateRepository = associateRepository;
        this.#casesRepository = casesRepository;
        this.#interactionRepository = interactionRepository;
    }

    async execute(interactionId, activeGroupScope = null) {
        if (!interactionId) {
            return { case_ids: [], items: [] };
        }

        if (activeGroupScope) {
            const interaction = await this.#interactionRepository?.findByIdForActiveGroup(
                interactionId,
                activeGroupScope
            );
            if (!interaction) {
                throw new CustomError('Interaction not found', 404);
            }
        }

        const rows = await this.#associateRepository.findByInteractionId(interactionId);
        const caseIds = [...new Set((rows ?? []).map((row) => row.caso_id).filter(Boolean))];

        if (caseIds.length === 0) {
            return { case_ids: [], items: [] };
        }

        const items = await this.#casesRepository.findSummaryByIds(caseIds);

        return {
            case_ids: caseIds,
            items,
        };
    }
}
