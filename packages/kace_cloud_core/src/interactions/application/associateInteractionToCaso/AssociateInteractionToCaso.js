import { CaseFinder } from '../../../cases/domain/CaseFinder';
import { CustomError } from '../../../shared';
import { InteractionFinderDomain } from '../../domain/InteractionFinderDomain';
import { KnexAssociateInteractionToCasoRepo } from '../../infrastructure/persistence/KnexAssociateInteractionToCasoRepo';

export class AssociateInteractionToCaso {
    /** @type {KnexAssociateInteractionToCasoRepo} is initialized in the constructor*/
    #repository;
    /** @type {CaseFinder} is initialized in the constructor*/
    #caseFinder;
    /** @type {InteractionFinderDomain} is initialized in the constructor*/
    #interactionFinder;
    #interactionRepository;

    /**
     *
     * @param {KnexAssociateInteractionToCasoRepo} repository
     */

    constructor(repository, casesRepo, interactionRepo) {
        this.#repository = repository;
        this.#caseFinder = new CaseFinder(casesRepo);
        this.#interactionFinder = new InteractionFinderDomain(interactionRepo);
        this.#interactionRepository = interactionRepo;
    }

    /**
     *
     * @param {object} dto data to insert a new associate interaction to case
     * @returns {Promise<Any>}
     */
    async execute(dto, activeGroupScope = null) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);

        const interactionId = dto.interaction_id;
        const casoId = dto.caso_id;

        if (activeGroupScope) {
            return this.#executeForActiveGroup(dto, activeGroupScope);
        }

        const interaction = await this.#interactionFinder.execute(interactionId);
        if (!interaction) throw new CustomError('Interaction not found', 400);

        const caso = await this.#caseFinder.execute(casoId);
        if (!caso) throw new CustomError('Interaction not found', 400);

        const exists = await this.#repository.exists(interactionId, casoId);
        if (exists) return;

        await this.#repository.save(dto);
    }

    async #executeForActiveGroup(dto, activeGroupScope) {
        const interactionId = dto.interaction_id;
        const casoId = dto.caso_id;

        await this.#interactionRepository.withTransaction(async (trx) => {
            const interaction = await this.#interactionRepository.findByIdForActiveGroup(
                interactionId,
                activeGroupScope,
                {
                    trx,
                    forUpdate: true,
                }
            );
            if (!interaction) throw new CustomError('Interaction not found', 404);

            const caso = await this.#caseFinder.execute(casoId);
            if (!caso) throw new CustomError('Interaction not found', 404);

            const exists = await this.#repository.exists(interactionId, casoId, { trx });
            if (!exists) await this.#repository.save(dto, { trx });
        });
    }
}
