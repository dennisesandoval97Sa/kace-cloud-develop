import { Action } from '../../domain/Action.js';
import { Helper, InvalidArgumentError } from '../../../shared/index.js';
import { ClassificationFinder } from '../../../classifications/domain/ClassificationFinder.js';
import { ActiveGroupFinderByExternalCode } from '../../../grupos/domain/ActiveGroupFinderByExternalCode.js';
import { GroupsFinder } from '../../../grupos/domain/GroupsFinder.js';
import { Case, CaseUpdater } from '../../../cases/index.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignGroupByExternalCodeCase {
    static ACTION_TYPE = ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value;

    /** @type {CaseUserAssignmentService} */
    #caseUserAssignmentService;

    /**
     * Creates an instance of `AssignUserByExternalCodeCase`.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} userRepository - Repository for managing user operations.
     * @param {KnexGroupsRepository} groupRepository
     * @param {KnexClassificationRepository} classificationRepository
     * @param {AssignationService} assignationService
     */
    constructor(caseRepository, userRepository, groupRepository, classificationRepository, assignationService) {
        this.caseRepository = caseRepository;
        this.groupRepository = groupRepository;
        this.activeGroupFinderByExternalCode = new ActiveGroupFinderByExternalCode(groupRepository);
        this.groupsFinder = new GroupsFinder(groupRepository);
        this.userFinder = new UserFinder(userRepository);
        this.assignationService = assignationService;
        this.classificationFinder = new ClassificationFinder(classificationRepository);
        this.#caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    async execute(caseEntity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        try {
            if (!(caseEntity instanceof Case)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
            }
            currentAdvisorId = caseEntity.updated_by.value || caseEntity.created_by.value;
            if (!(action instanceof Action)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Action".');
            }
            const group = await this.activeGroupFinderByExternalCode.execute(action.external_group_code.value);

            let groupId = null;
            if (group) {
                groupId = group.id.value;
                Helper.logDebug(`[AssignGroupByExternalCodeCase] Group found: ${groupId}`);
            } else {
                const classification = await this.classificationFinder.execute(caseEntity.clasificacion_id.value);
                if (!classification || !classification.default_group_id.value) {
                    throw new Error('No se encontró un grupo por defecto en la clasificación del caso.');
                }
                groupId = classification.default_group_id.value;
                await this.#ensureDefaultGroupIsActive(groupId);
                Helper.logDebug(`[AssignGroupByExternalCodeCase] Group not found, Default group: ${groupId}`);
            }

            originalValues = caseEntity.toJson();
            const responsibleId = await this.assignationService.execute(groupId, caseEntity.id.value);
            if (responsibleId) {
                await this.#caseUserAssignmentService.execute(
                    caseEntity,
                    responsibleId,
                    groupId,
                    ValueObjectAssignmentChangeType.ACTION
                );
                result = true;
                Helper.logDebug(
                    `[AssignGroupByExternalCodeCase] Success - Assigned to user: ${responsibleId}, group: ${groupId}`
                );
            } else {
                Helper.logDebug(`[AssignGroupByExternalCodeCase] No responsible assigned for group: ${groupId}`);
            }
        } catch (error) {
            Helper.logError('Error al asignar grupo según criterios:', error);
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
            actionType: AssignGroupByExternalCodeCase.ACTION_TYPE,
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

    /**
     * The classification fallback must not funnel cases into a group that no longer operates.
     *
     * @private
     * @param {string} groupId
     */
    async #ensureDefaultGroupIsActive(groupId) {
        const defaultGroup = await this.groupsFinder.execute(groupId);
        if (!defaultGroup || !defaultGroup.isActive()) {
            throw new Error(`El grupo por defecto de la clasificación está inactivo: ${groupId}`);
        }
    }
}
