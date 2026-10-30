import { Action } from '../../domain/Action.js';
import { Helper, InvalidArgumentError } from '../../../shared/index.js';
import { ClassificationFinder } from '../../../classifications/domain/ClassificationFinder.js';
import { ActiveGroupFinderByExternalCode } from '../../../grupos/domain/ActiveGroupFinderByExternalCode.js';
import { GroupsFinder } from '../../../grupos/domain/GroupsFinder.js';
import { Case } from '../../../cases/index.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import { AuxCasesFinderByCase } from '../../../aux_casos/domain/AuxCasesFinderByCase.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';

export class AssignGroupByExternalDynamicCode {
    static ACTION_TYPE = ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value;

    /**
     * Creates an instance of AssignGroupByExternalDynamicCode.
     *
     * @param {KnexCaseRepository} caseRepository - Repository for managing case operations.
     * @param {KnexUsersRepository} userRepository - Repository for managing user operations.
     * @param {KnexGroupsRepository} groupRepository - Repository for managing group operations.
     * @param {KnexClassificationRepository} classificationRepository - Repository for managing classifications.
     * @param {AssignationService} assignationService - Service for assigning a responsible user.
     * @param {KnexAuxCasesRepository} auxCaseRepository - Repository for auxiliary case data.
     */
    constructor(
        caseRepository,
        userRepository,
        groupRepository,
        classificationRepository,
        assignationService,
        auxCaseRepository
    ) {
        this.caseRepository = caseRepository;
        this.groupRepository = groupRepository;
        this.activeGroupFinderByExternalCode = new ActiveGroupFinderByExternalCode(groupRepository);
        this.groupsFinder = new GroupsFinder(groupRepository);
        this.auxCasesFinderByCase = new AuxCasesFinderByCase(auxCaseRepository);
        this.userFinder = new UserFinder(userRepository);
        this.assignationService = assignationService;
        this.classificationFinder = new ClassificationFinder(classificationRepository);
        this.caseUserAssignmentService = new CaseUserAssignmentService(caseRepository);
        this.eventLogger = new EventLogger(caseRepository);
    }

    /**
     * Executes the group assignment process for a given case and action.
     *
     * @param {Case} caseEntity - The case entity to update.
     * @param {Action} action - The action containing external group code.
     * @returns {Promise<boolean>} Whether the assignment was successful.
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
            const auxCase = await this.auxCasesFinderByCase.execute(caseEntity.id.value);

            if (!auxCase || !auxCase.data.value) {
                throw new Error(
                    'AssignGroupByExternalDynamicCode: No aux case data found for case ID:',
                    caseEntity.id.value
                );
            }

            const value = this.#getNestedValue(auxCase.data.value, action.external_group_dynamic_code.value);
            if (!value) {
                throw new Error(
                    'AssignGroupByExternalDynamicCode: No value found for external group code in aux case data.'
                );
            }
            const group = await this.activeGroupFinderByExternalCode.execute(value);

            let groupId = null;
            if (group) {
                groupId = group.id.value;
            } else {
                const classification = await this.classificationFinder.execute(caseEntity.clasificacion_id.value);
                if (!classification || !classification.default_group_id.value) {
                    throw new Error(
                        'AssignGroupByExternalDynamicCode: No default group found for classification ID:',
                        caseEntity.clasificacion_id.value
                    );
                }
                groupId = classification.default_group_id.value;
                await this.#ensureDefaultGroupIsActive(groupId);
            }

            const responsibleId = await this.assignationService.execute(groupId, caseEntity.id.value);
            if (responsibleId) {
                await this.caseUserAssignmentService.execute(
                    caseEntity,
                    responsibleId,
                    groupId,
                    ValueObjectAssignmentChangeType.ACTION
                );
                result = true;
            } else {
                Helper.logInfo('AssignGroupByExternalDynamicCode: No responsible user found for group ID:', groupId);
            }
        } catch (error) {
            Helper.logError('AssignGroupByExternalDynamicCode: Error al asignar grupo según criterios:', error);
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
            actionType: AssignGroupByExternalDynamicCode.ACTION_TYPE,
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

    /**
     * The classification fallback must not funnel cases into a group that no longer operates.
     *
     * @private
     * @param {string} groupId
     */
    async #ensureDefaultGroupIsActive(groupId) {
        const defaultGroup = await this.groupsFinder.execute(groupId);
        if (!defaultGroup || !defaultGroup.isActive()) {
            throw new Error(
                `AssignGroupByExternalDynamicCode: El grupo por defecto de la clasificación está inactivo: ${groupId}`
            );
        }
    }
}
