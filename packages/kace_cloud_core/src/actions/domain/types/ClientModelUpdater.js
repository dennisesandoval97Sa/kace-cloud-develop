import { ActionUpdateModel } from '../../../action-update-model/index.js';
import { Client } from '../../../clients/domain/Client.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ClientModelUpdater {
    /** @type {FormulaEvaluator} is initialized in the constructor */
    #formulaEvaluator;
    /** @type {ModelValueSaver} is initialized in the constructor */
    #modelValueSaver;

    /**
     * Creates an instance of `ClientModelUpdater`.
     *
     * @param {FormulaEvaluator} formulaEvaluator - Service for calculating and updating values based on the model's formula.
     * @param {ModelValueSaver} modelValueSaver - Service for updating client model.
     */
    constructor(formulaEvaluator, modelValueSaver) {
        this.#formulaEvaluator = formulaEvaluator;
        this.#modelValueSaver = modelValueSaver;
    }

    /**
     * Updates a client model based on the provided model update definition.
     *
     * @param {ActionUpdateModel} modelUpdate - The model update definition.
     * @param {Client} client - The client to be updated.
     * @param {Object} [content=null] - Optional additional content for evaluation.
     * @returns {Promise<boolean>} - Returns `true` if the model was updated, `false` otherwise.
     * @throws {InvalidArgumentError} - If the provided entities are not valid instances.
     */
    async execute(modelUpdate, client) {
        try {
            if (!(modelUpdate instanceof ActionUpdateModel)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "ActionUpdateModel".');
            }
            if (!(client instanceof Client)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Client".');
            }

            let value = modelUpdate.value.value ?? null;

            if (modelUpdate.isFormulaType()) {
                value = await this.#formulaEvaluator.executeForClient(modelUpdate, client);
            }

            if (modelUpdate.isNumberType()) {
                value = +value;
            }

            await this.#modelValueSaver.executeV2({
                modelName: modelUpdate.aggregate.value,
                field: modelUpdate.field.value,
                value,
                cliente_id: client.id.value,
            });

            return true;
        } catch (error) {
            Helper.logError('Error executing ClientModelUpdater:', error);
            return false;
        }
    }
}
