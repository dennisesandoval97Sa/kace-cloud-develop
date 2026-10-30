import { EventLogger } from '../../../shared/EventLogger.js';
import { ActionTriggers } from '../../../shared/index.js';

export class AutomatedAssignmentEventLogger {
    constructor(caseRepository) {
        this.eventLogger = caseRepository && caseRepository.connection ? new EventLogger(caseRepository) : null;
    }

    async logEvent({ success, action, caseEntity, originalValues }) {
        if (!this.eventLogger || !action?.id?.value) return;

        const eventBody = {
            description: action?.description?.value,
            actionType: action?.action_type?.value,
            trigger: ActionTriggers.CRON_JOB.value,
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
            action.id.value,
            null,
            eventBody,
            caseEntity.id?.value,
            caseEntity.cliente_id?.value,
            oldData
        );
    }
}
