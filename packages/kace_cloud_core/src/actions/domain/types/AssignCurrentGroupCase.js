import { Case, CaseUpdater } from '../../../cases/index.js';
import { Helper, InvalidArgumentError } from '../../../shared/index.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignCurrentGroupCase {
    static ACTION_TYPE = ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value;

    /**
     * Creates an instance of `AssignCurrentGroupCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} userRepository - Repository for managing user operations.
     * @param {AssignationService} assignationService - Service that handles the logic for user assignments to a group.
     */
    constructor(caseRepository, userRepository, assignationService) {
        this.caseRepository = caseRepository;
        this.userFinder = new UserFinder(userRepository);
        this.assignationService = assignationService;
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Executes the logic of assigning the current group and responsible user to the case.
     * It updates the case with the `grupo_id` from the advisor's active group and assigns a responsible user.
     *
     * @param {Case} caseEntity - The case entity to which the group and responsible user will be assigned.
     * @param {import('../Action.js').Action} action - The action containing the external user code.
     * @returns {Promise<boolean>} - Returns `true` if the operation was successful, `false` if any error occurs.
     */
    async execute(caseEntity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        try {
            if (!(caseEntity instanceof Case)) {
                throw new InvalidArgumentError('El caso proporcionado no es una instancia válida de "Case".');
            }

            currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
            const advisor = await this.userFinder.execute(currentAdvisorId);
            const responsibleId = await this.assignationService.execute(
                advisor.grupo_activo.value,
                caseEntity.id.value
            );

            originalValues = caseEntity.toJson();

            if (responsibleId) {
                await this.caseUserAssignmentService.execute(
                    caseEntity,
                    responsibleId,
                    advisor.grupo_activo.value,
                    ValueObjectAssignmentChangeType.ACTION
                );
                result = true;
            }
        } catch (error) {
            Helper.logError('AssignCurrentGroupCase execution error:', error);
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
            actionType: AssignCurrentGroupCase.ACTION_TYPE,
            trigger,
            success: success,
            responsable_id: caseEntity.responsable_id.value,
            grupo_id: caseEntity.grupo_id.value,
            transicion_id: caseEntity.transicion_id.value,
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
