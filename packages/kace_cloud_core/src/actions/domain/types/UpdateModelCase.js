import { Action } from '../../domain/Action.js';
import { ActionUpdateModel, DomainActionUpdateModelFinder } from '../../../action-update-model/index.js';
import { Case } from '../../../cases/index.js';
import { CaseFinder } from '../../../cases/domain/CaseFinder.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { ActionTypes } from '../ActionTypes.js';

export class UpdateModelCase {
    static ACTION_TYPE = ActionTypes.ACTUALIZAR_MODELO.value;

    /** @type {FormulaEvaluator} is initialized in the constructor */
    #formulaEvaluator;
    /** @type {ModelValueSaver} is initialized in the constructor */
    #modelValueSaver;

    /**
     * Creates an instance of `AssignUserByExternalCodeCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexActionUpdateModelRepository} actionUpdateModelRepository - Repository for managing user operations.
     * @param {FormulaEvaluator} formulaEvaluator - Service for calculating and updating values based on the model's formula.
     * @param {ModelValueSaver} modelValueSaver - Service for updating model.
     */
    constructor(caseRepository, actionUpdateModelRepository, formulaEvaluator, modelValueSaver) {
        this.caseFinder = new CaseFinder(caseRepository);
        this.modelUpdateFinder = new DomainActionUpdateModelFinder(actionUpdateModelRepository);

        this.#formulaEvaluator = formulaEvaluator;
        this.#modelValueSaver = modelValueSaver;
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Assigns a user to a case based on an external user code.
     *
     * @param {Case} caseEntity - The case to be updated.
     * @param {Action} action - The action containing the external user code.
     * @returns {Promise<boolean>} - Returns `true` if the user was assigned, `false` otherwise.
     * @throws {InvalidArgumentError} - If the provided entity is not a valid instance of "Case" or "Action".
     */
    async execute(caseEntity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        if (!(caseEntity instanceof Case)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
        }

        currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
        originalValues = caseEntity.toJson();

        if (!(action instanceof Action)) {
            throw new InvalidArgumentError('The provided entity is not a valid instance of "Action".');
        }

        const kase = await this.caseFinder.execute(caseEntity.id.value);
        if (!kase) {
            throw new Error(`Case with ID ${caseEntity.id.value} not found.`);
        }

        const modelUpdate = await this.modelUpdateFinder.execute(action.model_update_id.value);
        if (!modelUpdate || !(modelUpdate instanceof ActionUpdateModel)) {
            throw new Error(`No modelUpdate found with the id: ${action.model_update_id.value}`);
        }

        try {
            let value = modelUpdate.value.value ?? null;

            if (modelUpdate.isFormulaType()) {
                value = await this.#formulaEvaluator.execute(modelUpdate, kase);
            }

            if (modelUpdate.isNumberType()) {
                value = +value;
            }

            await this.#modelValueSaver.execute(modelUpdate.aggregate.value, modelUpdate.field.value, value, kase);

            result = true;
        } catch (error) {
            Helper.logError('Error al ejecutar el UpdateModelCase:', error);
        }

        if (modelUpdate.aggregate.value === 'Case' && modelUpdate.field.value === 'fecha_resolucion') {
            if (result) {
                await this.logEventCaseClose(kase, currentAdvisorId, originalValues);
            } else {
                Helper.logWarning(`Case ${kase.id.value}: fecha_resolucion update failed. Skipping case.closed event.`);
            }
        } else {
            await this.#logEvent({
                success: result,
                aggregateId: action?.id?.value,
                description: action?.description?.value,
                trigger,
                currentUserId: currentAdvisorId,
                caseEntity,
                originalValues,
            });
        }

        return result;
    }

    /**
     * @param {Case} kase
     * @param { string } currentAdvisorId
     * @param { Object } originalValues
     */
    async logEventCaseClose(kase, currentAdvisorId, originalValues) {
        await this.eventLogger.log(
            'case.closed',
            kase.id.value,
            currentAdvisorId,
            {
                fecha_resolucion: kase.changedAttributes.fecha_resolucion,
                transicion_id: kase.transicion_id.value,
            },
            kase.id.value,
            kase.cliente_id.value,
            {
                fecha_resolucion: originalValues?.fecha_resolucion,
                transicion_id: originalValues?.transicion_id,
            }
        );
    }

    async #logEvent({ success, aggregateId, description, currentUserId, caseEntity, originalValues, trigger }) {
        if (!aggregateId || !currentUserId) return;

        const eventBody = {
            description,
            actionType: UpdateModelCase.ACTION_TYPE,
            trigger,
            success,
        };

        const oldData = {
            responsable_id: originalValues?.responsable_id,
            grupo_id: originalValues?.grupo_id,
            transicion_id: originalValues?.transicion_id,
        };

        await this.eventLogger.log(
            'action.executed',
            aggregateId,
            currentUserId,
            eventBody,
            caseEntity.id.value,
            caseEntity.cliente_id.value,
            oldData
        );
    }
}
