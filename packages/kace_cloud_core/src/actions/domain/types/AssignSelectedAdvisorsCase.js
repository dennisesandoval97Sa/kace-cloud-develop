import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { Case } from '../../../cases/index.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignSelectedAdvisorsCase {
    static ACTION_TYPE = ActionTypes.ASIGNAR_LISTA_ASESORES.value;

    /**
     * Creates an instance of `AssignSelectedAdvisorsCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUserListsRepository} userListRepository - Repository for managing user operations.
     */
    constructor(caseRepository, userListRepository) {
        this.caseRepository = caseRepository;
        this.userListRepository = userListRepository;
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Assigns a selected advisor (user) to the case.
     *
     * @param {Case} caseEntity - The case to which the advisor will be assigned.
     * @param {import('../Action.js').Action} action - The action containing the external user code.
     * @returns {Promise<boolean>} - Returns `true` if the assignment is successful, `false` otherwise.
     */
    async execute(caseEntity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        try {
            if (!(caseEntity instanceof Case)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
            }

            const selectedUser = await this.userListRepository.findSelectedAdvisor(
                action.advisor_list_id,
                caseEntity.id
            );
            if (!selectedUser) {
                throw new Error(
                    `No users were selected from the user list with ID ${action.advisor_list_id.value} in AssignSelectedAdvisorsCase execution.`
                );
            }

            currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
            originalValues = caseEntity.toJson();
            await this.caseUserAssignmentService.execute(
                caseEntity,
                selectedUser.id,
                selectedUser.grupo_activo,
                ValueObjectAssignmentChangeType.ACTION
            );
            result = true;
        } catch (error) {
            Helper.logError('Error al asignar asesores seleccionados:', error);
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
            actionType: AssignSelectedAdvisorsCase.ACTION_TYPE,
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
}
