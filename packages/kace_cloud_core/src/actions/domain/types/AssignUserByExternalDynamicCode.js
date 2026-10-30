import { Case, CaseUpdater } from '../../../cases/index.js';
import { Action } from '../../domain/Action.js';
import { Criteria, Helper, InvalidArgumentError } from '../../../shared/index.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import { AuxCasesFinderByCase } from '../../../aux_casos/domain/AuxCasesFinderByCase.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignUserByExternalDynamicCode {
    static ACTION_TYPE = ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO.value;

    /**
     * Creates an instance of `AssignUserByExternalDynamicCode`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} userRepository - Repository for managing user operations.
     * @param {KnexAuxCasesRepository} auxCaseRepository - Repository for auxiliary case data.
     */
    constructor(caseRepository, userRepository, auxCaseRepository) {
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
        this.auxCasesFinderByCase = new AuxCasesFinderByCase(auxCaseRepository);
        this.userFinder = new UserFinder(userRepository);
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Assigns a user to a case based on an external user code.
     *
     * @param {Case} caseEntity - The case to be updated.
     * @param {Action} action - The action containing the external user code.
     * @returns {Promise<boolean>} - Returns `true` if the user was assigned, `false` otherwise.
     */
    async execute(caseEntity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        try {
            if (!(caseEntity instanceof Case)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
            }

            currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
            originalValues = caseEntity.toJson();

            if (!(action instanceof Action)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Action".');
            }

            const tablename = this.userRepository.tableName;
            const auxCase = await this.auxCasesFinderByCase.execute(caseEntity.id.value);
            if (!auxCase || !auxCase.data.value) {
                throw new Error('Auxiliary case data not found or is null.');
            }
            const value = this.#getNestedValue(auxCase.data.value, action.external_user_dynamic_code.value);
            if (!value) {
                throw new Error('The external user code path is invalid or not found.');
            }
            const criteria = this.#generateCriteria(value, tablename);
            const users = await this.userRepository.search(criteria);
            if (!users || !users.length) {
                throw new Error('No user found with the provided external code.');
            }
            const user = users[0];
            if (!user.grupo_activo.value) {
                throw new Error(`The user with external code: ${action.external_user_code.value} has no active group.`);
            }
            await this.caseUserAssignmentService.execute(
                caseEntity,
                user.id.value,
                user.grupo_activo.value,
                ValueObjectAssignmentChangeType.ACTION
            );

            result = true;
        } catch (error) {
            Helper.logError('Error al asignar usuario según criterios:', error);
        }

        await this.#logEvent({
            success: result,
            aggregateId: action?.id?.value,
            description: action?.description?.value,
            trigger,
            currentUserId: currentAdvisorId,
            caseEntity,
            originalValues,
        });

        return result;
    }

    async #logEvent({ success, aggregateId, description, currentUserId, caseEntity, originalValues, trigger }) {
        if (!aggregateId || !currentUserId) return;

        const eventBody = {
            description: description,
            actionType: AssignUserByExternalDynamicCode.ACTION_TYPE,
            trigger,
            success: success,
            responsable_id: caseEntity.responsable_id.value,
            grupo_id: caseEntity.grupo_id.value,
            transicion_id: caseEntity.transicion_id.value,
        };

        const oldData = {
            responsable_id: originalValues.responsable_id,
            grupo_id: originalValues.grupo_id,
            transicion_id: originalValues.transicion_id,
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

    #generateCriteria(externalCode, tablename) {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        //TODO: Validar que solo sea usuario con rol agente o supervisor
        const filters = [
            {
                field: 'codigos_externos',
                operator: 'jsonArrayValue',
                value: `${externalCode}`,
                type: 'AND',
            },
        ];

        const limit = 1;
        const offset = 0;
        return new Criteria(filters, null, limit, offset, null, tablename);
    }

    /**
     * Retrieves a nested value from a data object using a path string.
     *
     * @private
     * @param {Object} data - The object to traverse.
     * @param {string} path - The path string (e.g., 'a.b[0].c').
     * @returns {*} The value at the specified path or undefined.
     */
    #getNestedValue(data, path) {
        if (!data || typeof data !== 'object') return undefined;

        const fields = path.split(/[.[\]]/g).filter(Boolean);

        let current = data;
        for (const key of fields) {
            if (current === undefined || current === null) return undefined;
            current = current[key];
        }

        return current;
    }
}
