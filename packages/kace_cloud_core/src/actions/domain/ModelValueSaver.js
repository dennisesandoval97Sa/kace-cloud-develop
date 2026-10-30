import { AuxCases, AuxCasesUpdater, DomainAuxCasesFinderByCase } from '../../aux_casos/index.js';
import { Client, ClientUpdater } from '../../clients/index.js';
import { AuxClients, AuxClientsUpdater, DomainAuxClientsFinderByClient } from '../../aux_clientes/index.js';
import { Case, CaseUpdater, CasoAnsCalculator, SubcasesOpenStatusService } from '../../cases/index.js';
import { CaseFinder } from '../../cases/domain/CaseFinder.js';
import { ClientFinder } from '../../clients/domain/ClientFinder.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';
import { GroupsFinder } from '../../grupos/domain/GroupsFinder.js';
import { AgentCasesConfigFinder } from '../../global-config/domain/AgentCasesConfigFinder.js';
import { NestedValueManager } from '../../shared/domain/utilities/NestedValueManager.js';

export class ModelValueSaver {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #caseRepository;
    /** @type {KnexClientRepository} is initialized in the constructor */
    #clientRepository;
    /** @type {KnexAuxCasesRepository} is initialized in the constructor */
    #auxCasesRepository;
    /** @type {KnexClientRepository} is initialized in the constructor */
    #auxClientsRepository;

    /**
     * Creates an instance of `ModelValueSaver`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexCaseRepository} clientRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} auxCasesRepository - Repository for managing user operations.
     * @param {KnexUsersRepository} auxClientsRepository - Repository for managing user operations.
     * @param {KnexUsersRepository} groupsRepository - Repository for managing groups operations.
     * @param {KnexUsersRepository} globalConfigurationRepository - Repository for managing global configurations operations.
     * @param {KnexUsersRepository} subcaseRelationshipRepository - Repository for managing subcases operations.
     *
     *
     */
    constructor(
        caseRepository,
        clientRepository,
        auxCasesRepository,
        auxClientsRepository,
        groupsRepository,
        globalConfigurationRepository,
        subcaseRelationshipRepository
    ) {
        this.#caseRepository = caseRepository;
        this.#clientRepository = clientRepository;
        this.#auxCasesRepository = auxCasesRepository;
        this.#auxClientsRepository = auxClientsRepository;

        this.ansCalculator = new CasoAnsCalculator(caseRepository);
        this.caseFinder = new CaseFinder(caseRepository);
        this.clientFinder = new ClientFinder(clientRepository);
        this.auxCasesFinderByCase = new DomainAuxCasesFinderByCase(auxCasesRepository);
        this.auxClientsFinderByClient = new DomainAuxClientsFinderByClient(auxClientsRepository);

        this.caseUpdater = new CaseUpdater(this.#caseRepository);
        this.clientUpdater = new ClientUpdater(this.#clientRepository);
        this.auxCasesUpdater = new AuxCasesUpdater(this.#auxCasesRepository, this.#caseRepository);
        this.auxClientsUpdater = new AuxClientsUpdater(this.#auxClientsRepository);

        this.groupFinder = new GroupsFinder(groupsRepository);
        this.agentCasesConfigFinder = new AgentCasesConfigFinder(globalConfigurationRepository);
        this.subcasesOpenStatusService = new SubcasesOpenStatusService({
            subcaseRepo: subcaseRelationshipRepository,
        });
    }

    /**
     * Saves the calculated value to the appropriate repository based on the model type.
     *
     * @param {string} modelName - The model name (Case, Client, AuxCases, AuxClient).
     * @param {string} field - The field to be updated.
     * @param {*} value - The value to be saved.
     * @param {Case} caso - The case instance used to retrieve the model.
     */
    async execute(modelName, field, value, caso) {
        if (!(caso instanceof Case)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
        }

        const modelMap = {
            Case: async () => this.#saveToCase(caso.id.value, field, value),
            Client: async () => this.#saveToClient(caso.cliente_id.value, field, value),
            AuxCases: async () => this.#saveToAuxCase(caso.id.value, field, value),
            AuxClient: async () => this.#saveToAuxClient(caso.cliente_id.value, field, value),
            default: () => {
                throw new InvalidArgumentError('ModelValueSaver: Modelo no soportado');
            },
        };

        return (modelMap[modelName] || modelMap['default'])();
    }

    /**
     * Saves the calculated value to the appropriate repository based on the model type.
     *
     * @param {Object} params - An object containing modelName, field, value, cliente_id, and caso_id.
     * @param {string} params.modelName - The model name (Case, Client, AuxCases, AuxClient).
     * @param {string} params.field - The field to be updated.
     * @param {*} params.value - The value to be saved.
     * @param {string} params.cliente_id - The client ID.
     * @param {string} params.caso_id - The case ID.
     */
    async executeV2({ modelName, field, value, cliente_id, caso_id }) {
        if (!cliente_id && !caso_id) {
            throw new InvalidArgumentError('Both cliente_id and caso_id must be provided.');
        }

        if (typeof field !== 'string' || !field) {
            throw new InvalidArgumentError('Field must be a valid string and cannot be empty.');
        }

        const modelMap = {
            Case: async () => this.#saveToCase(caso_id, field, value),
            Client: async () => this.#saveToClient(cliente_id, field, value),
            AuxCases: async () => this.#saveToAuxCase(caso_id, field, value),
            AuxClient: async () => this.#saveToAuxClient(cliente_id, field, value),
            default: () => {
                throw new InvalidArgumentError('ModelValueSaver: Modelo no soportado');
            },
        };

        return (modelMap[modelName] || modelMap['default'])();
    }

    /**
     * Saves the value to the Case model.
     *
     * @param {string} caseId - The ID of the case to be updated.
     * @param {string} field - The field to be updated.
     * @param {*} value - The value to be saved.
     */
    async #saveToCase(caseId, field, value) {
        const kase = await this.caseFinder.execute(caseId);

        if (!(kase instanceof Case) || typeof field !== 'string' || !field) {
            throw new InvalidArgumentError('saveToCase: Invalid case or field');
        }

        if (!(field in kase)) {
            throw new InvalidArgumentError(`saveToCase: Field "${field}" does not exist on Case model`);
        }

        const sensitiveFields = ['fecha_resolucion', 'transicion_id', 'state_change_at'];
        const shouldRecalculateANS = sensitiveFields.includes(field);

        if (field === 'fecha_resolucion' && value != null) {
            const grupo = await this.groupFinder.execute(kase.grupo_id.value);
            const assignmentConfig = await this.agentCasesConfigFinder.execute(grupo);
            const hasOpen = await this.subcasesOpenStatusService.hasOpenChildren(kase.id.value);
            const allow = !!assignmentConfig.allow_close_case_without_subcases;
            if (!allow && hasOpen) {
                throw new InvalidArgumentError(
                    'The case cannot be closed: it has open subcases, and the group configuration prohibits it.'
                );
            }
        }

        if (shouldRecalculateANS) {
            await this.ansCalculator.execute(caseId);
        }

        const dto = {
            [field]: value,
            updated_at: kase.updated_at.value ?? kase.created_at.value,
            updated_by: kase.updated_by.value ?? kase.created_by.value,
            ...(field === 'transicion_id' ? { update_source: null } : {}),
        };

        if (field === 'fecha_resolucion' && value != null) {
            dto.closed_at = value;
            dto.closed_by = kase.updated_by.value ?? kase.created_by.value;
        }
        const saveEventLog = field !== 'fecha_resolucion';
        await this.caseUpdater.execute(caseId, dto, saveEventLog);
    }

    /**
     * Saves the value to the Client model.
     *
     * @param {string} clientId - The ID of the client to be updated.
     * @param {string} field - The field to be updated.
     * @param {*} value - The value to be saved.
     */
    async #saveToClient(clientId, field, value) {
        const client = await this.clientFinder.execute(clientId);

        if (!(client instanceof Client) || typeof field !== 'string' || !field) {
            throw new InvalidArgumentError('saveToCase: Invalid client or field');
        }

        if (!(field in client)) {
            throw new InvalidArgumentError(`saveToClient: Field "${field}" does not exist on Client model`);
        }

        const dto = { [`${field}`]: value };

        await this.clientUpdater.execute(clientId, dto);
    }

    /**
     * Saves the value to the AuxCases model.
     *
     * @param {string} caseId - The ID of the case to find the associated AuxCase.
     * @param {string} field - The field to be updated.
     * @param {*} value - The value to be saved.
     */
    async #saveToAuxCase(caseId, field, value) {
        const auxCase = await this.auxCasesFinderByCase.execute(caseId);

        if (!(auxCase instanceof AuxCases) || typeof field !== 'string' || !field) {
            throw new InvalidArgumentError('saveToAuxCase: Invalid aux case or field');
        }

        const currentValue = NestedValueManager.getValue(auxCase.data.value, field);
        if (JSON.stringify(currentValue) === JSON.stringify(value)) {
            throw new InvalidArgumentError('saveToAuxCase: No changes were applied');
        }

        const updates = [{ path: field, value: value }];
        await this.auxCasesUpdater.executeJsonbUpdates(updates, auxCase.id.value);
    }

    /**
     * Saves the value to the AuxClient model.
     *
     * @param {string} clientId - The ID of the cliente to find the associated AuxClient.
     * @param {string} field - The field to be updated.
     * @param {*} value - The value to be saved.
     */
    async #saveToAuxClient(clientId, field, value) {
        const auxClient = await this.auxClientsFinderByClient.execute(clientId);

        if (!(auxClient instanceof AuxClients) || typeof field !== 'string' || !field) {
            throw new InvalidArgumentError('saveToAuxClient: Invalid aux client or field');
        }

        const currentValue = NestedValueManager.getValue(auxClient.data.value, field);
        if (JSON.stringify(currentValue) === JSON.stringify(value)) {
            throw new InvalidArgumentError('saveToAuxClient: No changes were applied');
        }

        const partialData = {};
        NestedValueManager.setValue(partialData, field, value);
        const dto = { data: partialData };

        await this.auxClientsUpdater.execute(dto, auxClient.id.value);
    }
}
