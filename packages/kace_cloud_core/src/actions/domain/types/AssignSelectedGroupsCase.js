import { UserFinder } from '../../../users/domain/UserFinder.js';
import { ClassificationFinder } from '../../../classifications/domain/ClassificationFinder.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { Case } from '../../../cases/index.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignSelectedGroupsCase {
    static ACTION_TYPE = ActionTypes.ASIGNAR_LISTA_GRUPOS.value;

    /**
     * Creates an instance of `AssignSelectedGroupsCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for case operations.
     * @param {KnexUsersRepository} userRepository - Repository for user operations.
     * @param {KnexClassificationRepository} classificationRepository - Repository for classification operations.
     * @param {AssignationService} assignationService - Service that handles the logic for user assignments to a group.
     */
    constructor(caseRepository, userRepository, classificationRepository, assignationService) {
        this.caseRepository = caseRepository;
        this.userFinder = new UserFinder(userRepository);
        this.assignationService = assignationService;
        this.classificationFinder = new ClassificationFinder(classificationRepository);
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Assigns a group to a case based on the selected group or classification settings.
     *
     * @param {Case} caseEntity - The case to which the group and responsible user will be assigned.
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

            currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
            originalValues = caseEntity.toJson();

            let responsibleId = await this.assignationService.execute(
                caseEntity.asignacion_grupo.value,
                caseEntity.id.value
            );
            if (!responsibleId) {
                const classification = await this.classificationFinder.execute(caseEntity.clasificacion_id.value);

                if (classification && classification.default_group_id.value) {
                    responsibleId = await this.assignationService.execute(
                        classification.default_group_id.value,
                        caseEntity.id.value
                    );

                    if (!responsibleId) {
                        throw new Error(
                            `No responsible user found for default group ID ${classification.default_group_id.value}`
                        );
                    }
                } else {
                    throw new Error(
                        `No responsible user found for selected group ID ${caseEntity.asignacion_grupo.value}, and no default group set in classification.`
                    );
                }
            }

            await this.caseUserAssignmentService.execute(
                caseEntity,
                responsibleId,
                caseEntity.asignacion_grupo.value,
                ValueObjectAssignmentChangeType.ACTION
            );
            result = true;
        } catch (error) {
            Helper.logError('Error al asignar grupos seleccionados:', error);
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
            actionType: AssignSelectedGroupsCase.ACTION_TYPE,
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
