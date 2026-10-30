import { DomainCaseFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { CASE_TRANSITION_NOT_ALLOWED } from '@kace/error-codes';
import { ActionTriggers } from '../../../actions/index.js';
import { CanUpdateCase, Helper } from '../../../shared/index.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { UpdateSLATimers } from '../../../shared/domain/services/UpdateSLATimers.js';
import CaseUpdated from '../../domain/events/CaseUpdated.js';
import { TransitionRuleValidator } from '../../../transition-rules/domain/TransitionRuleValidator.js';

export class CaseTransitionsUpdater {
    /** @type {KnexCaseRepository} is initialized in the constructor*/
    #casesRepository;

    /** @type {KnexTransitionsCaseRepository} is initialized in the constructor*/
    #transitionsRepository;

    /** @type {DomainCaseFinder} is initialized in the constructor*/
    #finder;

    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionDomainService;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /** @type {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository|null} */
    #transitionRuleRepository;

    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /** @type {Tenant|null} */
    #tenant;

    /**
     *
     * @param {KnexCaseRepository} casesRepository
     * @param {KnexTransitionsCaseRepository} transitionsRepository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param user
     * @param {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository} [transitionRuleRepository]
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher]
     * @param {Tenant} [tenant]
     */
    constructor(
        casesRepository,
        transitionsRepository,
        actionExecutionService,
        user,
        transitionRuleRepository = null,
        eventPublisher = null,
        tenant = null
    ) {
        this.#casesRepository = casesRepository;
        this.#transitionsRepository = transitionsRepository;
        this.#finder = new DomainCaseFinder(casesRepository);
        this.#actionExecutionDomainService = actionExecutionService;
        this.#user = user;
        this.#transitionRuleRepository = transitionRuleRepository;
        this.#eventPublisher = eventPublisher || null;
        this.#tenant = tenant;
        this.eventLogger = new EventLogger(casesRepository);
    }

    /**
     *
     * @param {string} id identificator case to update
     * @param {object} dto data for update case
     */
    async execute(id, dto) {
        Helper.logTime('CaseTransitionsUpdater');
        const kase = await this.#finder.execute(id);

        if (kase === null) {
            throw new CustomError('The Case you are trying update does not exist', 404);
        }

        if (!CanUpdateCase.check(this.#user, kase)) {
            throw new CustomError('You do not have permission to update this case', 403);
        }

        const currentTransitionId = kase.toJson().transicion_id ?? null;
        const { transitions } = await this.#transitionsRepository.findAvailableTransitions(currentTransitionId);

        const allowed = new Set(transitions.map((t) => t.transicion_id));
        if (!allowed.has(dto.transicion_id)) {
            throw new CustomError(
                'The provided transition is not allowed from the current state',
                400,
                [],
                CASE_TRANSITION_NOT_ALLOWED
            );
        }

        const matchedTransition = transitions.find((t) => t.transicion_id === dto.transicion_id);
        if (this.#transitionRuleRepository) {
            await TransitionRuleValidator.enforceRuleForTransition(
                dto.transicion_id,
                this.#transitionsRepository,
                this.#transitionRuleRepository,
                kase,
                this.#casesRepository
            );
        }

        const originalValues = kase.toJson();

        const now = new Date().toISOString();
        const updatePayload = {
            transicion_id: dto.transicion_id,
            updated_at: now,
            updated_by: this.#user.id.value,
            update_source: dto.update_source,
        };
        if (!this.#user?.isServiceAccount) {
            updatePayload.edited_at = now;
            updatePayload.edited_by = this.#user.id.value;
        }
        kase.update(updatePayload);

        if (kase.changedAttributes.transicion_id) {
            kase.state_change_at = kase.changedAttributes.updated_at;
            if (!('update_source' in dto)) {
                kase.update_source = null;
            }
        }

        await this.#casesRepository.update(kase);
        await this.#casesRepository.saveHistory(kase, originalValues);
        Helper.logTimeEnd('CaseTransitionsUpdater');

        Helper.logTime('CASE_TRANSITION_UPDATE.SLA');
        await this.#calculateSLATimers(kase);
        Helper.logTimeEnd('CASE_TRANSITION_UPDATE.SLA');

        if (kase.changedAttributes.transicion_id) {
            Helper.logTime('CASE_TRANSITION_UPDATE.ACTIONS');
            await this.eventLogger.log(
                'case.state_changed',
                id,
                this.#user.id.value,
                {
                    transicion_id: kase.changedAttributes.transicion_id,
                },
                id,
                kase.cliente_id.value,
                {
                    transicion_id: originalValues.transicion_id,
                }
            );
            Helper.logTimeEnd('CASE_TRANSITION_UPDATE.ACTIONS');
        } else {
            Helper.logInfo(
                'CaseTransitionsUpdater',
                `No ejecuto acciones caso: ${kase.id.value}`,
                typeof this.#actionExecutionDomainService,
                kase.changedAttributes
            );
        }

        await this.#publishDomainEvents(kase);

        kase.flushChanges();
    }

    /**
     * Calculates and updates SLA timers for the given case after a transition change
     * This is particularly important for state-based SLA calculations
     * @param {import('../../domain/Case.js').Case} kase - The case to calculate SLA for
     * @private
     */
    async #calculateSLATimers(kase) {
        try {
            const {
                kase: kaseForAns,
                caseAns,
                shiftManagement,
                stateAns,
                globalConfig,
            } = await this.#finder.executeForAns(kase.id.value);

            const originalValues = kaseForAns.toJson();

            const slaUpdater = new UpdateSLATimers(kaseForAns, shiftManagement, caseAns, stateAns, globalConfig);
            await slaUpdater.execute();

            await this.#casesRepository.update(kaseForAns);
            await this.#casesRepository.saveHistory(kaseForAns, originalValues);

            Helper.logInfo(`SLA timers updated successfully after transition change for case ${kase.id.value}`, 'SLA');
        } catch (error) {
            Helper.logError(`Error calculating SLA timers after transition change for case ${kase.id.value}:`, error);
        }
    }

    /**
     * Records and publishes domain events for transition-driven case changes.
     * @param {import('../../domain/Case.js').Case} kase - The updated case.
     * @private
     */
    async #publishDomainEvents(kase) {
        if (!this.#eventPublisher || !kase.changedAttributes.transicion_id) {
            return;
        }

        try {
            kase.recordDomainEvent(
                new CaseUpdated({
                    caseId: kase.id.value,
                    changedAttributes: kase.changedAttributes,
                    trigger: ActionTriggers.STATE_CHANGE.value,
                    metadata: {
                        tenant_id: this.#tenant?.id?.value || null,
                        user_id: this.#user.id.value,
                        correlation_id: null,
                        causation_id: null,
                    },
                })
            );

            const domainEvents = kase.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            Helper.logError('CaseTransitionsUpdater: Failed to publish domain events', error);
        }
    }
}
