import { ActionTriggers } from '../../../actions/index.js';
import { Case } from '../../domain/Case.js';
import { CaseResponse } from '../CaseResponse.js';
import { CaseFinder as DomainCaseFinder } from '../../domain/CaseFinder.js';
import { CaseFolioGenerator } from '../folio/CaseFolioGenerator.js';
import { TenantContext, ValidationFailError } from '../../../shared/index.js';
import { Helper } from '../../../shared/index.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { CaseCreated } from '../../domain/events/CaseCreated.js';
import { TransitionRuleValidator } from '../../../transition-rules/domain/TransitionRuleValidator.js';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType.js';

export class CaseCreator {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;
    /** @type {CaseFolioGenerator} */
    #folioGenerator;

    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /** @type {Tenant} */
    #tenant;

    /** @type {User} */
    #currentUser;

    /** @type {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository|null} */
    #transitionRuleRepository;

    /** @type {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository|null} */
    #transitionsCaseRepository;

    /**
     *
     * @param {KnexCaseRepository} repository
     * @param {ActionExecutionDomainService} [deprecatedActionExecutionService] - Sin uso desde
     *   f221ef838: CaseCreator publica CaseCreated y quien ejecuta las acciones es el
     *   event_processor. Se conserva la posicion porque el constructor es posicional y hay mas
     *   de treinta llamadores; pasarlo no ejecuta ninguna accion.
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher] - Optional event publisher for domain events
     * @param {Tenant} tenant
     * @param {User} currentUser
     * @param {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository} [transitionRuleRepository]
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} [transitionsCaseRepository]
     */
    constructor(
        repository,
        deprecatedActionExecutionService,
        eventPublisher,
        tenant,
        currentUser,
        transitionRuleRepository = null,
        transitionsCaseRepository = null
    ) {
        this.#repository = repository;
        this.#eventPublisher = eventPublisher || null;
        this.#folioGenerator = new CaseFolioGenerator(repository);
        this.finder = new DomainCaseFinder(repository);
        this.eventLogger = new EventLogger(repository);
        this.#tenant = tenant ?? TenantContext.getTenant();
        this.#currentUser = currentUser;
        this.#transitionRuleRepository = transitionRuleRepository;
        this.#transitionsCaseRepository = transitionsCaseRepository;
    }

    /**
     * @param {object} dto - object with data to create a case
     * @param {object|null} [config] - optional execution config
     * @param {boolean} [config.skipTransitionValidation=false] - when true, skips
     *   TransitionRuleValidator.enforceRuleForTransition. Use only when the caller has
     *   already validated the transition (e.g. actionCreateWithAux calls
     *   enforceRuleForTransitionWithMergedContext before constructing CaseCreator).
     *   NOTE: actionCreateWithAux also omits the 7th constructor arg
     *   (transitionsCaseRepository), so this flag is currently defense-in-depth; if that
     *   arg is ever passed, the flag prevents a redundant second validation.
     * @param {import('knex').Knex.Transaction} [config.trx] - optional transaction. When
     *   provided, execute() performs PERSISTENCE ONLY (save + saveHistory on the transactional
     *   connection) and DEFERS all side-effects (event publish, event logging) to
     *   runPostPersistence(), which the caller MUST invoke AFTER the transaction commits.
     *
     * DUAL RETURN SHAPE:
     *   - No trx (default): runs side-effects inline and resolves to a `CaseResponse`
     *     (byte-for-byte identical to the historical behavior; all existing callers rely on this).
     *   - With config.trx: resolves to `{ response: CaseResponse, kase: Case }` so the caller can
     *     pass `kase` to runPostPersistence() once the transaction has committed.
     * @returns {Promise<CaseResponse | { response: CaseResponse, kase: import('../../domain/Case.js').Case }>}
     */
    async execute(dto, config = null) {
        if (dto.external_code) {
            dto.external_code = await this.#folioGenerator.execute(dto.external_code, config);
        }

        dto.last_assigned_at = new Date();
        dto.assignment_change_type = dto.assignment_change_type ?? ValueObjectAssignmentChangeType.CREATION;
        const kase = Case.create(dto);

        const result = await this.finder.execute(kase.id.value);
        if (result) {
            throw new ValidationFailError(`Id ${dto.id} already exists`, 'id');
        }

        if (dto.external_code) {
            const existingByCode = await this.#repository.findByExternalCode(dto.external_code);
            if (existingByCode) {
                throw new ValidationFailError(`External code ${dto.external_code} already exists`, 'external_code');
            }
        }

        if (
            dto.transicion_id &&
            this.#transitionRuleRepository &&
            this.#transitionsCaseRepository &&
            !config?.skipTransitionValidation
        ) {
            await TransitionRuleValidator.enforceRuleForTransition(
                dto.transicion_id,
                this.#transitionsCaseRepository,
                this.#transitionRuleRepository,
                dto,
                this.#repository,
                'dto'
            );
        }

        // Configurable folio (radicado). Independent of the legacy external_code folio
        // above: a tenant can have both enabled at once.
        //
        // Reserved last, right before the INSERT and inside config.trx when the caller
        // provides one: the counter row stays locked only until the case is written, and a
        // rollback returns the number instead of burning it. The resolver returns null when
        // the classification has no configuration, which leaves folio untouched.
        if (config?.folioResolver && !kase.folio?.value) {
            const folio = await config.folioResolver.execute({
                classificationId: dto.clasificacion_id,
                caseDto: dto,
                auxData: config.auxData,
                trx: config.trx,
            });
            if (folio) {
                kase.folio = folio;
            }
        }

        const kaseSaved = await this.#repository.save(kase, config?.trx);
        await this.#repository.saveHistory(kaseSaved, null, config?.trx);

        if (config?.trx) {
            // Persistence done inside the caller's transaction. Side-effects (event publish,
            // event logging) MUST run after commit, so defer them to runPostPersistence()
            // which the caller invokes once the transaction commits.
            return { response: new CaseResponse(kaseSaved), kase: kaseSaved };
        }

        await this.runPostPersistence(kaseSaved);
        return new CaseResponse(kaseSaved);
    }

    /**
     * Runs the post-commit side-effects for a created case: event logging and domain event
     * publishing. Invoked inline by execute() when no transaction is used, and by the caller
     * AFTER commit when execute() ran inside a transaction.
     *
     * SLA timers are intentionally NOT computed here: the async event_processor consuming
     * kace.core.case.created (ExecuteActionsOnCaseCreated) already writes SLA timers + history
     * on every case.created, so a synchronous computation would be a duplicate.
     *
     * Each step is best-effort (its own try/catch).
     * @param {import('../../domain/Case.js').Case} kaseSaved - the persisted case
     * @returns {Promise<void>}
     */
    async runPostPersistence(kaseSaved) {
        await this.#handleEventLogging(kaseSaved, {});
        await this.#publishDomainEvents(kaseSaved);
    }

    async #handleEventLogging(kase, originalValues) {
        const id = kase.id.value;
        const currentUser = kase.created_by.value;
        const clientId = kase.cliente_id.value;

        const filterNullValues = (obj) => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(filterNullValues);

            return Object.entries(obj).reduce((acc, [key, value]) => {
                if (value !== null) {
                    acc[key] = typeof value === 'object' ? filterNullValues(value) : value;
                }
                return acc;
            }, {});
        };

        await this.eventLogger.log(
            'case.updated',
            id,
            currentUser,
            filterNullValues(kase.toJson()),
            id,
            clientId,
            originalValues
        );
    }

    /**
     * Records and publishes domain events for the created case.
     * @param {import('../../domain/Case.js').Case} kase - The created case
     * @private
     */
    async #publishDomainEvents(kase) {
        if (!this.#eventPublisher) {
            return;
        }

        try {
            kase.recordDomainEvent(
                new CaseCreated({
                    caseId: kase.id.value,
                    clientId: kase.cliente_id.value,
                    responsibleId: kase.responsable_id.value,
                    classificationId: kase.clasificacion_id.value,
                    groupId: kase.grupo_id.value,
                    transitionId: kase.transicion_id.value,
                    metadata: {
                        tenant_id: this.#tenant.id.value,
                        user_id: this.#currentUser.id.value,
                        correlation_id: null,
                        causation_id: null,
                    },
                })
            );

            const domainEvents = kase.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            Helper.logError('CaseCreator: Failed to publish domain events', error);
        }
    }
}
