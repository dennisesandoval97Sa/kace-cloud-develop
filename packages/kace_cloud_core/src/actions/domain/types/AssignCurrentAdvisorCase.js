import { Case } from '../../../cases/index.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignCurrentAdvisorCase {
    static ACTION_TYPE = ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value;

    /**
     * Creates an instance of `AssignCurrentAdvisorCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} userRepository - Repository for managing user operations.
     */
    constructor(caseRepository, userRepository) {
        this.caseRepository = caseRepository;
        this.userFinder = new UserFinder(userRepository);
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Executes the logic to assign a selected advisor (user) to a specific case.
     *
     * @param {Case} caseEntity - The case entity to which the advisor will be assigned.
     * @param {import('../Action.js').Action} action - The action containing the external user code.
     * @returns {Promise<boolean>} - Returns `true` if the assignment was successful, or `false` if an error occurred.
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
            const advisor = await this.userFinder.execute(currentAdvisorId);

            originalValues = caseEntity.toJson();
            await this.caseUserAssignmentService.execute(
                caseEntity,
                advisor.id.value,
                advisor.grupo_activo.value,
                ValueObjectAssignmentChangeType.ACTION
            );

            result = true;
        } catch (error) {
            Helper.logInfo('AssignCurrentAdvisorCase execution error:', error);
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
            actionType: AssignCurrentAdvisorCase.ACTION_TYPE,
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
