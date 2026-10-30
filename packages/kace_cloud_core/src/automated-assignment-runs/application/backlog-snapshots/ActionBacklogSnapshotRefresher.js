import dayjs from 'dayjs';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';
import { NO_PREFILTER } from '../../../actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { AUTOMATION_NOT_APPLICABLE_REASON } from '../../../automation-settings/domain/AutomationValidationService.js';

const COUNTED_TYPE = ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value;

// El job y la corrida evalúan minutos distintos: el cron de la automatización no decide aquí.
const isRunnableAtSomeMinute = ({ applicable, reason }) =>
    applicable || reason === AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH;

/**
 * Recalcula fuera de la corrida de asignación el conteo de pendientes de cada regla de
 * código externo y deja la última cifra válida por regla. La corrida solo lee estas cifras.
 */
export class ActionBacklogSnapshotRefresher {
    #actionsFinder;
    #automationValidation;
    #candidateFinder;
    #snapshotsRepository;
    #now;

    constructor({ actionsFinder, automationValidation, candidateFinder, snapshotsRepository, now = () => new Date() }) {
        this.#actionsFinder = actionsFinder;
        this.#automationValidation = automationValidation;
        this.#candidateFinder = candidateFinder;
        this.#snapshotsRepository = snapshotsRepository;
        this.#now = now;
    }

    /** @returns {Promise<{ counted: number, skipped: number, failed: number, removed: number }>} */
    async execute() {
        const found = await this.#actionsFinder.findActionsIfEligible({
            actionTypeFilter: { include: [COUNTED_TYPE] },
            service: 'ActionBacklogSnapshotRefresher',
        });
        // Sin lista no se sabe qué reglas siguen vigentes: no se toca ninguna cifra.
        if (!Array.isArray(found)) return { counted: 0, skipped: 0, failed: 0, removed: 0 };

        const actions = found.filter((action) => action?.action_type?.value === COUNTED_TYPE);
        const skippedIds = new Set();
        let counted = 0;
        let failed = 0;

        for (const action of actions) {
            const actionId = action.id.value;
            try {
                // Fuera de ventana la corrida no lee la cifra: se borra para que al reabrirla no lea una vieja.
                const automation = await this.#automationValidation.evaluate(action.automation_id.value);
                if (!isRunnableAtSomeMinute(automation)) {
                    skippedIds.add(actionId);
                    continue;
                }
                const computedAt = this.#now();
                const startedAt = Date.now();
                const backlog = await this.#candidateFinder.count(action, { evaluationNow: dayjs() });
                if (backlog === NO_PREFILTER) {
                    failed++;
                    Helper.logError(
                        `ActionBacklogSnapshotRefresher: count unavailable for action ${actionId}, keeping last value`
                    );
                    continue;
                }
                await this.#snapshotsRepository.upsert({
                    action_id: actionId,
                    backlog,
                    computed_at: computedAt,
                    duration_ms: Date.now() - startedAt,
                });
                counted++;
            } catch (error) {
                failed++;
                Helper.logError(`ActionBacklogSnapshotRefresher: refresh failed for action ${actionId}`, error);
            }
        }

        let removed = 0;
        try {
            const keptIds = actions.map((action) => action.id.value).filter((id) => !skippedIds.has(id));
            removed = await this.#snapshotsRepository.deleteNotIn(keptIds);
        } catch (error) {
            Helper.logError('ActionBacklogSnapshotRefresher: stale snapshot cleanup failed', error);
        }

        const skipped = skippedIds.size;
        Helper.logInfo('automated-assignment.backlog-snapshots', {
            actions: actions.length,
            counted,
            skipped,
            failed,
            removed,
        });
        return { counted, skipped, failed, removed };
    }
}
