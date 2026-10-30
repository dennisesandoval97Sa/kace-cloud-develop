import { v4 as uuidV4 } from 'uuid';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { AutomatedAssignmentRun } from '../AutomatedAssignmentRun.js';
import { RUN_STATUS } from '../RunStatus.js';

export { RUN_STATUS };

const toFiniteOrNull = (value) => (Number.isFinite(value) ? value : null);

// Tope de usuarios disponibles persistidos por grupo: en grupos sin filtros de sesión
// "disponibles" = todos los miembros (400+), y la fila del run se ejecuta cada minuto.
const MAX_AVAILABLE_USERS_PERSISTED = 50;

// Lista {usuario_id, with_capacity} — primero los que tienen cupo (en su orden de
// prioridad de asignación), luego los saturados. Recortada al tope.
const buildAvailableUsers = (entry) => {
    const withCapacity = (entry?.users ?? []).map((user) => String(user?.id));
    const withCapacitySet = new Set(withCapacity);
    const allAvailable = Array.isArray(entry?.available_user_ids) ? entry.available_user_ids.map(String) : [];
    const ordered = [
        ...withCapacity.map((id) => ({ usuario_id: id, with_capacity: true })),
        ...allAvailable
            .filter((id) => !withCapacitySet.has(id))
            .map((id) => ({ usuario_id: id, with_capacity: false })),
    ];
    return {
        available_users: ordered.slice(0, MAX_AVAILABLE_USERS_PERSISTED),
        available_users_truncated: ordered.length > MAX_AVAILABLE_USERS_PERSISTED,
    };
};

/**
 * Colector en memoria de la telemetría de un ciclo de AutomatedAssignmentJob.
 * Toda su API es infalible por diseño: acumular nunca lanza, y persist() es
 * best-effort — un fallo de BD se loguea y jamás rompe la asignación.
 *
 * Se propaga como dependencia OPCIONAL (los call-sites usan `observer?.`):
 * el código y los tests existentes funcionan sin él.
 */
export class AssignmentRunObserver {
    #repository;
    #startedAt = null;
    #status = null;
    #actions = new Map();
    #notApplicableActions = [];
    #capacity = [];
    #prefilterMetrics = null;
    #totals = null;
    #groupAssignments = new Map();
    #errorDetail = null;

    constructor(repository) {
        this.#repository = repository;
    }

    recordStart() {
        this.#startedAt = new Date();
    }

    /** @param {string} status - uno de RUN_STATUS */
    recordOutcome(status) {
        // recordError ya fijó ERROR; no degradarlo a completed.
        if (this.#status !== RUN_STATUS.ERROR) {
            this.#status = status;
        }
    }

    recordActionsFound(actions) {
        const list = Array.isArray(actions) ? actions : [];
        for (const action of list) {
            const id = action?.id?.value;
            if (!id || this.#actions.has(id)) continue;
            this.#actions.set(id, {
                id,
                description: action?.description?.value ?? null,
                action_type: action?.action_type?.value ?? null,
                candidates: 0,
                candidates_backlog: null,
                backlog_computed_at: null,
                assigned: 0,
                skipped: 0,
                errors: 0,
                duration_ms: null,
                // skip_reasons son condiciones observadas, no un desglose exacto del contador skipped.
                skip_reasons: {},
            });
        }
    }

    /**
     * Acciones descartadas por la validación de automatización, con su razón
     * (AUTOMATION_NOT_APPLICABLE_REASON). Van al detalle del run para que un
     * no_eligible_actions se explique solo desde la UI.
     * @param {Array<{action: Object, reason: string}>} entries
     */
    recordNotApplicableActions(entries) {
        const list = Array.isArray(entries) ? entries : [];
        for (const entry of list) {
            const id = entry?.action?.id?.value;
            if (!id) continue;
            this.#notApplicableActions.push({
                id,
                description: entry?.action?.description?.value ?? null,
                action_type: entry?.action?.action_type?.value ?? null,
                reason: entry?.reason ?? null,
            });
        }
    }

    recordCapacitySnapshot(capacityContext) {
        const list = Array.isArray(capacityContext) ? capacityContext : [];
        this.#capacity = list.map((entry) => ({
            grupo_id: String(entry?.grupo_id),
            capacidad: toFiniteOrNull(entry?.capacidad),
            max_cases_per_user: toFiniteOrNull(entry?.max_cases_per_user),
            users_total: toFiniteOrNull(entry?.users_total),
            users_available: toFiniteOrNull(entry?.users_available),
            users_with_capacity: entry?.users?.length ?? 0,
            ...buildAvailableUsers(entry),
            assigned: 0,
            work_queue: true,
        }));
    }

    recordPrefilterMetrics(metrics) {
        this.#prefilterMetrics = metrics ?? null;
    }

    // Se asume UNA llamada por acción y ciclo: candidates/duration_ms se sobreescriben, los contadores acumulan.
    recordActionOutcome(action, outcome) {
        const {
            candidates = 0,
            candidates_backlog = null,
            backlog_computed_at = null,
            assigned = 0,
            skipped = 0,
            errors = 0,
            duration_ms = null,
        } = outcome ?? {};
        const id = action?.id?.value;
        if (!id) return;
        if (!this.#actions.has(id)) this.recordActionsFound([action]);
        const entry = this.#actions.get(id);
        entry.candidates = candidates;
        entry.candidates_backlog = candidates_backlog;
        entry.backlog_computed_at = backlog_computed_at;
        entry.assigned += assigned;
        entry.skipped += skipped;
        entry.errors += errors;
        entry.duration_ms = duration_ms;
    }

    /** @param {string} actionId - id plano (action.id.value) */
    recordSkipReason(actionId, reason, count = 1) {
        if (!actionId || !reason || !this.#actions.has(actionId)) return;
        const reasons = this.#actions.get(actionId).skip_reasons;
        reasons[reason] = (reasons[reason] ?? 0) + count;
    }

    recordGroupAssignment(groupId, count = 1) {
        if (groupId === null || groupId === undefined) return;
        const key = String(groupId);
        this.#groupAssignments.set(key, (this.#groupAssignments.get(key) ?? 0) + count);
    }

    recordTotals(totals) {
        const { assigned = 0, skipped = 0, errors = 0 } = totals ?? {};
        this.#totals = { assigned, skipped, errors };
    }

    recordError(error) {
        this.#status = RUN_STATUS.ERROR;
        // Solo el mensaje: el stack ya queda en CloudWatch (Helper.logError en los catch)
        // y persistirlo lo expondría por el API de detalle (rutas internas, internals).
        this.#errorDetail = {
            message: error?.message ?? String(error),
        };
    }

    /**
     * Un único INSERT con todo lo acumulado. Nunca lanza.
     * @returns {Promise<AutomatedAssignmentRun|null>}
     */
    async persist() {
        try {
            if (!this.#startedAt) return null;
            const finishedAt = new Date();
            const totals = this.#totals ?? this.#sumActionTotals();
            const groups = this.#capacity.map((group) => ({
                ...group,
                assigned: this.#groupAssignments.get(group.grupo_id) ?? 0,
            }));
            for (const [groupId, assigned] of this.#groupAssignments) {
                if (!groups.some((group) => group.grupo_id === groupId)) {
                    groups.push({
                        grupo_id: groupId,
                        capacidad: null,
                        max_cases_per_user: null,
                        users_total: null,
                        users_available: null,
                        users_with_capacity: null,
                        available_users: [],
                        available_users_truncated: false,
                        assigned,
                        work_queue: false,
                    });
                }
            }

            const run = AutomatedAssignmentRun.create({
                id: uuidV4(),
                started_at: this.#startedAt,
                finished_at: finishedAt,
                duration_ms: finishedAt.getTime() - this.#startedAt.getTime(),
                status: this.#status ?? RUN_STATUS.COMPLETED,
                actions_evaluated: this.#actions.size,
                candidates_total: this.#prefilterMetrics?.candidates_distinct ?? 0,
                candidates_backlog_total:
                    this.#prefilterMetrics?.candidates_backlog_total ??
                    this.#prefilterMetrics?.candidates_distinct ??
                    null,
                assigned: totals.assigned,
                skipped: totals.skipped,
                errors: totals.errors,
                groups_without_capacity: groups.filter(
                    (group) => group.users_with_capacity === 0 || group.capacidad === 0
                ).length,
                actions_detail: {
                    actions: [...this.#actions.values()],
                    not_applicable: this.#notApplicableActions,
                    prefilter: this.#prefilterMetrics,
                },
                capacity_snapshot: { groups },
                error_detail: this.#errorDetail,
            });

            await this.#repository.save(run);
            return run;
        } catch (error) {
            Helper.logError('AssignmentRunObserver.persist failed (observability is best-effort)', error);
            return null;
        }
    }

    #sumActionTotals() {
        const totals = { assigned: 0, skipped: 0, errors: 0 };
        for (const entry of this.#actions.values()) {
            totals.assigned += entry.assigned;
            totals.skipped += entry.skipped;
            totals.errors += entry.errors;
        }
        return totals;
    }
}
