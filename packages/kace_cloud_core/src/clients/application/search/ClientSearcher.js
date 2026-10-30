import { Criteria } from '../../../shared/criteria/Criteria';
import { Counter } from '../../../shared/domain/Counter';
import { ClientCollectionResponse } from '../ClientCollectionResponse';
import { WorkflowExecutor } from '../../index';

export class ClientSearcher {
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor*/
    #counter;

    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #groupsRepository;

    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor */
    #globalConfigRepository;

    /** @type {WorkflowExecutor} is initialized in the constructor */
    #workflowExecutor;

    constructor(
        repository,
        groupsRepository,
        globalConfigRepository,
        workflowStepRepository,
        allowedConnectionRepository,
        secretRepository,
        currentUser
    ) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
        this.#groupsRepository = groupsRepository;
        this.#globalConfigRepository = globalConfigRepository;
        this.#workflowExecutor = new WorkflowExecutor(
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );
    }

    async execute(dtoCriteria, idGrupoActivo) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );

        const groupConfig = await this.#configureRestflow(idGrupoActivo);
        if (groupConfig && groupConfig.execute_ws_restflow) {
            await this.#workflowExecutor.execute({ flow_id: groupConfig.flow_id });
        }

        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });
        return new ClientCollectionResponse(rows, count);
    }

    async #configureRestflow(idGrupoActivo) {
        if (!idGrupoActivo) {
            return { execute_ws_restflow: false };
        }

        const group = await this.#groupsRepository.find(idGrupoActivo);
        if (!group || !group.configuration_id) {
            return { execute_ws_restflow: false };
        }

        const config = await this.#globalConfigRepository.find(group.configuration_id);
        return config || { execute_ws_restflow: false };
    }
}
