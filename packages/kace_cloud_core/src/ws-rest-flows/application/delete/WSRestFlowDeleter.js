import { DomainWSRestFlowFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { WSRestFlowStepManager } from '../services/WSRestFlowStepManager.js';
import { KnexWSRestConditionalRepository } from '../../../ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import { Helper } from '../../../shared/index.js';

export class WSRestFlowDeleter {
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestFlowFinder} is initialized in the constructor */
    #finder;
    /** @type {WSRestFlowStepManager} is initialized in the constructor */
    #stepManager;
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #conditionalRepository;

    /**
     * Creates an instance of the `WSRestFlowDeleter` class.
     *
     * @param {KnexWSRestFlowRepository} repository - An instance of the repository that manages WS REST flows.
     * @param {KnexWSRestWorkflowStepRepository} stepRepository - An instance of the repository that manages workflow steps.
     */
    constructor(repository, stepRepository) {
        this.#repository = repository;
        this.#finder = new DomainWSRestFlowFinder(repository);
        this.#stepManager = new WSRestFlowStepManager(stepRepository);
        this.#conditionalRepository = new KnexWSRestConditionalRepository(repository.connection);
    }

    /**
     * Deletes a WSRestFlow object from the repository.
     *
     * @param {string} id - The unique identifier of the WSRestFlow object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the deletion process.
     * @returns {Promise<void>} A promise that resolves when the WSRestFlow object is deleted.
     */
    async execute(id, dto) {
        const wsRestFlow = await this.#finder.execute(id);

        if (!wsRestFlow) {
            throw new CustomError(`WSRestFlow with id ${id} does not exist.`, 404);
        }

        const diagram = wsRestFlow.json_diagram_properties?.value || {};
        const nodes = Array.isArray(diagram.nodes) ? [...diagram.nodes] : [];
        const conditionalNodes = nodes.filter((n) => n && n.data && n.data.type === 'conditional' && n.data.subflows);

        const subflowIds = new Set();
        const conditionalIds = new Set();

        for (const cond of conditionalNodes) {
            if (cond.data.id) conditionalIds.add(cond.data.id);
            const refs = Object.values(cond.data.subflows || {});
            for (const ref of refs) subflowIds.add(ref);
        }

        const allFlowIds = [id, ...Array.from(subflowIds)];
        await this.#stepManager.deleteStepsForMultipleFlows(allFlowIds);

        for (const conditionalId of conditionalIds) {
            try {
                await this.#conditionalRepository
                    .connection(this.#conditionalRepository.qualifiedName('ws_rest_conditionals'))
                    .where({ id: conditionalId })
                    .del();
            } catch (error) {
                Helper.logError(error);
                // Ignore missing conditionals
            }
        }

        for (const subflowId of subflowIds) {
            try {
                const subflow = await this.#finder.execute(subflowId);
                if (!subflow || subflow.isDeleted()) continue;

                if (subflow.is_primary.value) continue;

                subflow.delete(dto);
                await this.#repository.delete(subflow);
                subflow.flushChanges();
            } catch (error) {
                Helper.logError(error);
                // Ignore missing subflows and continue with others
            }
        }

        wsRestFlow.delete(dto);

        await this.#repository.delete(wsRestFlow);
        wsRestFlow.flushChanges();
    }
}
