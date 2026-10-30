import { CustomError } from '../../../shared/errors/CustomError';
import {
    CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION,
    CASE_BULK_TRANSITION_NOT_FOUND,
    CASE_TRANSITION_NOT_ALLOWED,
} from '@kace/error-codes';
import { ValueObjectUuid } from '../../../shared/index.js';
import { ValueObjectUpdateSource } from '../../domain/ValueObjectUpdateSource';
import { findAndValidateCases } from '../../domain/BulkCaseValidator';
import { TransitionRuleValidator } from '../../../transition-rules/domain/TransitionRuleValidator.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import CaseUpdated from '../../domain/events/CaseUpdated.js';
import { ActionTriggers } from '../../../actions/index.js';
import { Helper } from '../../../shared/index.js';

export class CaseBulkTransitionsUpdater {
    #casesRepository;
    #transitionsRepository;
    #user;
    #transitionRuleRepository;
    #eventPublisher;
    #tenant;

    constructor(
        casesRepository,
        transitionsRepository,
        user,
        transitionRuleRepository = null,
        eventPublisher = null,
        tenant = null
    ) {
        this.#casesRepository = casesRepository;
        this.#transitionsRepository = transitionsRepository;
        this.#user = user;
        this.#transitionRuleRepository = transitionRuleRepository;
        this.#eventPublisher = eventPublisher;
        this.#tenant = tenant;
        this.eventLogger = new EventLogger(this.#casesRepository);
    }

    async execute(caseIds, transitionId, updateSource = null) {
        const transition = await this.#transitionsRepository.findById(transitionId);

        if (!transition) {
            throw new CustomError(
                `Transition with id ${transitionId} does not exist.`,
                404,
                [],
                CASE_BULK_TRANSITION_NOT_FOUND
            );
        }

        if (this.#transitionRuleRepository) {
            const uniqueIds = [...new Set(caseIds)];
            for (const caseId of uniqueIds) {
                const kase = await this.#casesRepository.find(new ValueObjectUuid('id', caseId));
                if (kase) {
                    await TransitionRuleValidator.enforceRuleForTransition(
                        transitionId,
                        this.#transitionsRepository,
                        this.#transitionRuleRepository,
                        kase,
                        this.#casesRepository
                    );
                }
            }
        }

        const { cases, updateValues } = await this.#casesRepository.withTransaction(async (trx) => {
            const { uniqueCaseIds, cases } = await findAndValidateCases(this.#casesRepository, caseIds, {
                trx,
                forUpdate: true,
            });

            const currentTransitions = new Set(cases.map((caseRow) => caseRow.transicion_id));
            if (currentTransitions.size !== 1) {
                throw new CustomError(
                    'Cases must share the same current transition',
                    400,
                    [],
                    CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION
                );
            }

            const [currentTransitionId] = [...currentTransitions];
            const { transitions } = await this.#transitionsRepository.findAvailableTransitions(currentTransitionId, {
                trx,
            });
            const allowedTransitions = new Set(transitions.map((transitionValue) => transitionValue.transicion_id));

            if (!allowedTransitions.has(transitionId)) {
                throw new CustomError(
                    'The provided transition is not allowed from the current state',
                    400,
                    [],
                    CASE_TRANSITION_NOT_ALLOWED
                );
            }

            const now = new Date();
            const resolvedUpdateSource =
                updateSource ?? ValueObjectUpdateSource.fromCasesCount(uniqueCaseIds?.length).value;
            const updateValues = {
                transicion_id: transitionId,
                state_change_at: now,
                updated_at: now,
                updated_by: this.#user.id.value,
                update_source: resolvedUpdateSource,
            };

            if (!this.#user?.isServiceAccount) {
                updateValues.edited_by = this.#user.id.value;
                updateValues.edited_at = now;
            }
            await this.#casesRepository.bulkUpdateTransition(uniqueCaseIds, updateValues, { trx });
            await this.#casesRepository.bulkSaveTransitionHistory(cases, updateValues, { trx });

            return { cases, updateValues };
        });

        await this.#logStateChangedEvents(cases, transitionId);
        await this.#publishDomainEvents(cases, updateValues);
    }

    /**
     * Emite un evento case.state_changed por cada caso transicionado,
     * con la misma forma de payload que CaseUpdater.
     * @param {Array<Object>} cases - Filas originales de los casos (de findByIds).
     * @param {string} transitionId - Transición destino aplicada.
     * @private
     */
    async #logStateChangedEvents(cases, transitionId) {
        for (const caseRow of cases) {
            await this.eventLogger.log(
                'case.state_changed',
                caseRow.id,
                this.#user.id.value,
                { transicion_id: transitionId },
                caseRow.id,
                caseRow.cliente_id,
                { transicion_id: caseRow.transicion_id }
            );
        }
    }

    /**
     * Publica un evento de dominio CaseUpdated por cada caso transicionado,
     * con el mismo trigger (STATE_CHANGE) y metadata que CaseUpdater.
     * @param {Array<Object>} cases - Filas originales de los casos (de findByIds).
     * @param {Object} updateValues - Valores aplicados en la transición masiva.
     * @private
     */
    async #publishDomainEvents(cases, updateValues) {
        if (!this.#eventPublisher) {
            return;
        }
        try {
            const events = cases.map(
                (caseRow) =>
                    new CaseUpdated({
                        caseId: caseRow.id,
                        changedAttributes: updateValues,
                        trigger: ActionTriggers.STATE_CHANGE.value,
                        metadata: {
                            tenant_id: this.#tenant?.id?.value ?? null,
                            user_id: this.#user.id.value,
                            correlation_id: null,
                            causation_id: null,
                        },
                    })
            );
            await this.#eventPublisher.publishAll(events);
        } catch (error) {
            Helper.logError('CaseBulkTransitionsUpdater: Failed to publish domain events', error);
        }
    }
}
