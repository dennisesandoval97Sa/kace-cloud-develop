import { ActionUpdateModel } from '../../action-update-model/index.js';
import { AuxCases, DomainAuxCasesFinderByCase } from '../../aux_casos/index.js';
import { AuxClients, DomainAuxClientsFinderByClient } from '../../aux_clientes/index.js';
import { Case } from '../../cases/index.js';
import { Client } from '../../clients/domain/Client.js';
import { CaseFinder } from '../../cases/domain/CaseFinder.js';
import { ClientFinder } from '../../clients/domain/ClientFinder.js';
import { Helper, InvalidArgumentError, NestedValueManager, PasswordEncoder } from '../../shared/index.js';
import dayjs from 'dayjs';

export class FormulaEvaluator {
    /**
     * Creates an instance of `FormulaEvaluator`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexClientRepository} clientRepository - Repository for managing client operations.
     * @param {KnexAuxCasesRepository} auxCasesRepository - Repository for managing auxiliary cases.
     * @param {KnexAuxClientsRepository} auxClientsRepository - Repository for managing auxiliary clients.
     */
    constructor(caseRepository, clientRepository, auxCasesRepository, auxClientsRepository) {
        this.caseFinder = new CaseFinder(caseRepository);
        this.clientFinder = new ClientFinder(clientRepository);

        this.clientRepository = clientRepository;
        this.auxCasesRepository = auxCasesRepository;
        this.auxClientsRepository = auxClientsRepository;

        this.auxCasesFinderByCase = new DomainAuxCasesFinderByCase(auxCasesRepository);
        this.auxClientsFinderByClient = new DomainAuxClientsFinderByClient(auxClientsRepository);
    }

    /**
     * Executes the calculation or action update based on the formula defined in the `updateModel` for a case.
     *
     * @param {ActionUpdateModel} updateModel - The update model containing the formula.
     * @param {Case} caso - The case instance for context.
     * @param {Object} [additionalContent=null] - Optional additional content for evaluation.
     * @returns {Promise<*>} - The result of the formula calculation.
     * @throws {InvalidArgumentError} - If provided entities are not valid instances.
     */
    async execute(updateModel, caso) {
        if (!(updateModel instanceof ActionUpdateModel)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "ActionUpdateModel".');
        }

        if (!(caso instanceof Case)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
        }

        try {
            return await this.#processFormula(updateModel, caso, null);
        } catch (error) {
            const errorMessage = `Error executing formula for case ${caso.id.value}`;
            Helper.logError(`${errorMessage}:`, error);
            throw new Error(`${errorMessage}`);
        }
    }

    /**
     * Executes the calculation or action update based on the formula defined in the `updateModel` for a client.
     *
     * @param {ActionUpdateModel} updateModel - The update model containing the formula.
     * @param {Client} client - The client instance for context.
     * @returns {Promise<*>} - The result of the formula calculation.
     * @throws {InvalidArgumentError} - If provided entities are not valid instances.
     */
    async executeForClient(updateModel, client) {
        if (!(updateModel instanceof ActionUpdateModel)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "ActionUpdateModel".');
        }

        if (!(client instanceof Client)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "Client".');
        }

        try {
            return await this.#processFormula(updateModel, null, client);
        } catch (error) {
            const errorMessage = `Error executing formula for client ${client?.id?.value}`;
            Helper.logError(`${errorMessage}:`, error);
            throw new Error(`${errorMessage}`);
        }
    }

    /**
     * Process the formula based on the formula type and context (case or client).
     *
     * @param {ActionUpdateModel} updateModel - The update model containing the formula.
     * @param {Case|null} caso - The case instance for context, or null if client-only.
     * @param {Client|null} client - The client instance for context, or null if case-only.
     * @returns {Promise<*>} - The result of the formula calculation.
     * @private
     */
    async #processFormula(updateModel, caso, client) {
        const formulaHandlers = {
            fecha_actual: () => dayjs().format('YYYY-MM-DD'),
            hora_actual: () => dayjs().format('HH:mm:ss'),
            fecha_hora_actual: () => dayjs.utc().toISOString(),
            modelo_a_modelo: () => this.#getModelToModelValue(updateModel, caso, client),
            hash_sha256: async () => this.#setHash256ToField(updateModel, caso, client),
            boolean_true: () => true,
            boolean_false: () => false,
            default: () => {
                throw new Error(`Formula no soportada: ${updateModel.formula.value}`);
            },
        };

        const handler = formulaHandlers[updateModel.formula.value] || formulaHandlers['default'];
        return handler();
    }

    /**
     * Retrieves a value from one model based on a field in another model.
     * Supports both case and client contexts.
     *
     * @param {ActionUpdateModel} updateModel - The action update model containing the target field.
     * @param {Case|null} caso - The case instance, or null if client-only.
     * @param {Client|null} client - The client instance, or null if case-only.
     * @returns {Promise<any>} - The value from the corresponding model field.
     * @private
     */
    async #getModelToModelValue(updateModel, caso, client) {
        const field = updateModel.value.value;
        if (!field) {
            return '';
        }

        const [modelName, fieldPath] = field.split(/\.(.+)/).filter(Boolean);
        if (!modelName || !fieldPath) {
            return '';
        }

        const model = await this.#getModel(modelName, caso, client);
        return this.getModelValue(model, fieldPath) ?? '';
    }

    /**
     * Calculates the SHA-256 hash for the value specified in the model field.
     * Supports both case and client contexts.
     *
     * @param {ActionUpdateModel} updateModel - The action update model.
     * @param {Case|null} caso - The case instance, or null if client-only.
     * @param {Client|null} client - The client instance, or null if case-only.
     * @returns {Promise<string>} - The SHA-256 hash of the model value.
     * @private
     */
    async #setHash256ToField(updateModel, caso, client) {
        const model = await this.#getModel(updateModel.aggregate.value, caso, client);
        const modelValue = this.getModelValue(model, updateModel.field.value);

        return modelValue ? PasswordEncoder.generateHash(modelValue) : '';
    }

    /**
     * Retrieves the appropriate value from the model.
     *
     * @param {Object} model - The model object containing data.
     * @param {String} field - The field to extract.
     * @returns {any} - The extracted value or an empty string if the value doesn't exist.
     */
    getModelValue(model, field) {
        if (typeof model !== 'object' || typeof field !== 'string') {
            return '';
        }

        if (model instanceof AuxCases || model instanceof AuxClients) {
            return NestedValueManager.getValue(model.data?.value, field) || '';
        }

        return model[field]?.value || '';
    }

    /**
     * Retrieves the correct model instance based on the model name and context.
     * Supports both case and client contexts.
     *
     * @param {string} modelName - The name of the model to retrieve.
     * @param {Case|null} caso - The case instance, or null if client-only.
     * @param {Client|null} client - The client instance, or null if case-only.
     * @returns {Promise<Object>} - The model instance.
     * @throws {Error} - Throws an error if the model type is unsupported or context is invalid.
     * @private
     */
    async #getModel(modelName, caso, client) {
        if (caso) {
            const caseModelMap = {
                Case: () => caso,
                Client: async () => this.clientFinder.execute(caso.cliente_id.value),
                AuxCases: async () => this.auxCasesFinderByCase.execute(caso.id.value),
                AuxClient: async () => this.auxClientsFinderByClient.execute(caso.cliente_id.value),
            };

            if (caseModelMap[modelName]) {
                return caseModelMap[modelName]();
            }
        }

        if (client) {
            const clientModelMap = {
                Client: () => client,
                AuxClient: async () => this.auxClientsFinderByClient.execute(client.id.value),
            };

            if (clientModelMap[modelName]) {
                return clientModelMap[modelName]();
            }
        }

        throw new Error(`Modelo no soportado: ${modelName} o contexto inválido`);
    }
}
