import { CustomError } from '../../../shared/index.js';

export class AgentMoveDestinationFinder {
    #interactionRepository;

    constructor(interactionRepository) {
        this.#interactionRepository = interactionRepository;
    }

    async execute(interactionId, activeGroupScope) {
        const interaction = await this.#interactionRepository.findByIdForActiveGroup(interactionId, activeGroupScope);
        if (!interaction) throw new CustomError('Interaction not found', 404);

        return this.#interactionRepository.findEligibleAgentMoveDestinations(interaction.workspace_id);
    }
}
