import { DomainCaseFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ActionTriggers } from '../../../actions/index.js';
import { CanUseCapability, CanUpdateCase, Helper } from '../../../shared/index.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { UpdateSLATimers } from '../../../shared/domain/services/UpdateSLATimers.js';
import CaseUpdated from '../../domain/events/CaseUpdated.js';
import { TransitionRuleValidator } from '../../../transition-rules/domain/TransitionRuleValidator.js';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType.js';
import { STALE_FIELDS } from '../CaseStaleSnapshotEvaluator.js';
import { StaleSnapshotWriteError } from '../../domain/staleFields.js';

export class CaseUpdater {
    /** @type {KnexCaseRepository} is initialized in the constructor*/
    #repository;

    /** @type {DomainCaseFinder} is initialized in the constructor*/
    #finder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /** @type {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository|null} */
    #transitionRuleRepository;

    /** @type {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository|null} */
    #transitionsCaseRepository;

    /**
     *
     * @param {KnexCaseRepository} repository
     * @param {ActionExecutionDomainService} [deprecatedActionExecutionService] - Sin uso desde
     *   f221ef838: CaseUpdater publica CaseUpdated y quien ejecuta las acciones es el
     *   event_processor. Se conserva la posicion porque el constructor es posicional y hay mas
     *   de treinta llamadores; pasarlo no ejecuta ninguna accion.
     * @param {User | undefined } user
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher] - Optional event publisher for domain events
     * @param {Tenant} tenant
     * @param {import('../../../transition-rules/infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository} [transitionRuleRepository]
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} [transitionsCaseRepository]
     */
    constructor(
        repository,
        deprecatedActionExecutionService,
        user,
        eventPublisher,
        tenant,
        transitionRuleRepository = null,
        transitionsCaseRepository = null
    ) {
        this.#repository = repository;
        this.#finder = new DomainCaseFinder(repository);
        this.#user = user;
        this.#eventPublisher = eventPublisher || null;
        this.eventLogger = new EventLogger(repository);
        this.tenant = tenant;
        this.#transitionRuleRepository = transitionRuleRepository;
        this.#transitionsCaseRepository = transitionsCaseRepository;
    }

    /**
     * @param {string} id
     * @param {Object} dto
     * @param {boolean} [saveEventLog]
     * @param {Object} [options]
     * @param {boolean} [options.allowUpdateClosedCase]
     * @param {{ namespaces: readonly string[], moduleId: string, name: string }} [options.requiredPermission] -
     *   Capacidad que autoriza este guardado EN LUGAR de la propiedad del caso. Los flujos que no
     *   exigen ser responsable —reclasificar— la declaran aquí y el dominio la comprueba él mismo:
     *   sustituye al antiguo `skipOwnershipCheck`, que solo apagaba la única autorización que había
     *   y dejaba el caso de uso confiando enteramente en la capa de transporte.
     * @param {(trx?: import('knex').Knex.Transaction) => Promise<void>} [options.onBeforePersist] - Escritura
     *   que tiene que ser atómica con la del caso y ocurrir ANTES que ella, porque el caso ya
     *   la referencia (la reclasificación crea así el comentario al que apunta
     *   `cambio_estado_comentario_id`). Recibe la transacción que abre este caso de uso; si el
     *   repositorio no soporta transacciones, recibe `undefined` y escribe suelta, igual que el
     *   resto del flujo.
     * @param {string[]} [options.requireSnapshotMatch] - Campos cuyo CAS NO puede degradar. El
     *   comportamiento por defecto ante un snapshot obsoleto es no escribir ese campo, guardar el
     *   resto y avisar por `writeOutcome`; para los campos listados aquí se lanza
     *   `StaleSnapshotWriteError` dentro de la transacción y el guardado entero se deshace.
     *   Lo usa la reclasificación, donde escribir la transición del flujo destino sin la
     *   clasificación destino dejaría el caso en un estado imposible. Si el repositorio no
     *   soporta transacciones —igual que `onBeforePersist`— el error sigue abortando, pero lo ya
     *   escrito no se revierte; en producción todos los llamadores usan `KnexCaseRepository`.
     *   Se valida de entrada contra el catálogo `STALE_FIELDS` y contra el snapshot realmente
     *   recibido: nombrar aquí un campo que no llegaría a tener CAS convertiría la garantía en un
     *   no-op silencioso, así que es un 500 antes de tocar el caso.
     * @param {import('../folio/CaseFolioResolver.js').CaseFolioResolver} [options.folioResolver] - Si
     *   llega, un caso que todavía no tiene folio lo obtiene de su clasificación (posiblemente la
     *   nueva): cubre la reclasificación. Un caso que ya tiene folio lo conserva; un radicado no se
     *   regenera ni se reutiliza un consecutivo. Se reserva dentro de la transacción del guardado,
     *   así que un rollback devuelve el número en vez de quemarlo.
     * @param {Object} [options.auxData] - `aux_cases.data` para resolver las rutas aux_cases.*.
     */
    async execute(id, dto, saveEventLog = true, options = {}) {
        const {
            allowUpdateClosedCase = false,
            requiredPermission = null,
            onBeforePersist = null,
            requireSnapshotMatch = [],
            folioResolver = null,
            auxData = {},
        } = options;
        const kase = await this.#finder.execute(id);

        if (kase === null) {
            throw new CustomError('The Case you are trying update does not exist', 404);
        }

        // Los flujos que no exigen ser responsable —la reclasificación— declaran la capacidad que
        // sí exigen, y se comprueba aquí: la autorización no se apaga, se cambia por otra. Antes
        // esto se lograba pasando `user = null`, pero eso también apagaba la publicación de
        // `CaseUpdated` y dejaba sin correr las acciones automatizadas del destino.
        if (requiredPermission !== null && !CanUseCapability.isWellFormed(requiredPermission)) {
            // Un requiredPermission mal armado es un bug de quien llama a execute(), no una
            // denegación de autorización: dejar que caiga en CanUseCapability.check() lo
            // convertiría en un 403 indistinguible de un rechazo legítimo.
            throw new CustomError('requiredPermission is malformed', 500);
        }

        if (this.#user) {
            const authorized = requiredPermission
                ? CanUseCapability.check(this.#user, requiredPermission)
                : CanUpdateCase.check(this.#user, kase);

            if (!authorized) {
                throw new CustomError('You do not have permission to update this case', 403);
            }

            const nextClassification = dto.clasificacion_id ?? null;
            const currentClassification = kase.clasificacion_id?.value ?? null;
            if (nextClassification != null && String(nextClassification) !== String(currentClassification ?? '')) {
                const canReclassify =
                    requiredPermission != null && CanUseCapability.check(this.#user, requiredPermission);
                if (!canReclassify) {
                    throw new CustomError('You do not have permission to update this case', 403);
                }
            }
        }

        const wasResolved = Boolean(kase.fecha_resolucion?.value);
        if (wasResolved && !allowUpdateClosedCase) {
            throw new CustomError('The case is already resolved; updates are not allowed.', 403);
        }
        const skipSlaAndEvents = wasResolved && allowUpdateClosedCase;

        CaseUpdater.#assertRequiredFieldsAreKnown(requireSnapshotMatch);

        const casWrites = [];
        let dtoForUpdate = dto;
        for (const { field, resultKey, writeFlag } of STALE_FIELDS) {
            const snapshot = options[resultKey];
            const current = kase[field]?.value ?? null;
            const isIntendedWrite = dto[field] !== undefined && (dto[field] ?? null) !== current;

            // El CAS es lo ÚNICO que hace cumplir la obligación: declarar el campo obligatorio y
            // no mandar su snapshot escribiría el valor nuevo sin comprobar nada, que es
            // exactamente lo que `requireSnapshotMatch` promete impedir.
            if (snapshot === undefined) {
                if (isIntendedWrite && requireSnapshotMatch.includes(field)) {
                    throw new CustomError(
                        `Field "${field}" was declared in requireSnapshotMatch but no snapshot was provided for it`,
                        500
                    );
                }
                continue;
            }
            if (!isIntendedWrite) {
                continue;
            }
            if (dtoForUpdate === dto) {
                dtoForUpdate = { ...dto };
            }
            casWrites.push({ field, snapshot, intended: dto[field], writeFlag });
            delete dtoForUpdate[field];
        }

        dtoForUpdate = this.#buildUpdatePayload(dtoForUpdate);

        const originalValues = kase.toJson();

        kase.update(dtoForUpdate);

        if (kase.changedAttributes.transicion_id) {
            kase.state_change_at =
                kase.changedAttributes.updated_at ?? kase.updated_at?.value ?? new Date().toISOString();
            if (!('update_source' in dto)) {
                kase.update_source = null;
            }
        }

        if (
            kase.changedAttributes.responsable_id !== undefined &&
            kase.changedAttributes.assignment_change_type === undefined
        ) {
            kase.assignment_change_type = ValueObjectAssignmentChangeType.MANUAL;
        }

        if (dto.external_code) {
            const existingByCode = await this.#repository.findByExternalCode(dto.external_code);
            if (existingByCode && existingByCode.id.value !== kase.id.value) {
                throw new CustomError(`External code ${dto.external_code} already exists`, 400);
            }
        }

        if (dto.transicion_id && this.#transitionRuleRepository && this.#transitionsCaseRepository) {
            await TransitionRuleValidator.enforceRuleForTransition(
                dto.transicion_id,
                this.#transitionsCaseRepository,
                this.#transitionRuleRepository,
                kase,
                this.#repository
            );
        }

        const persistWrites = async (trx) => {
            if (onBeforePersist) {
                await onBeforePersist(trx);
            }

            // Después de todas las validaciones y dentro de la transacción del caso: si el CAS de
            // la clasificación o cualquier escritura posterior falla, el rollback devuelve el
            // consecutivo en vez de quemarlo. La clasificación con CAS todavía no está en el
            // agregado (se aplica en el bucle de abajo), así que el folio se resuelve contra la
            // de destino y no contra la que el caso abandona.
            if (folioResolver && !kase.folio?.value) {
                const pendingClassification = casWrites.find(({ field }) => field === 'clasificacion_id')?.intended;
                const classificationId = pendingClassification ?? kase.clasificacion_id.value;
                const folio = await folioResolver.execute({
                    classificationId,
                    caseDto: { ...kase.toJson(), clasificacion_id: classificationId },
                    auxData,
                    trx,
                });
                if (folio) {
                    kase.folio = folio;
                }
            }

            await this.#repository.update(kase, trx);

            const writeOutcome = Object.fromEntries(STALE_FIELDS.map(({ writeFlag }) => [writeFlag, false]));
            let persistCasSideFields = false;

            // Sequential CAS on one row: a single UPDATE ... CASE WHEN ... RETURNING
            // would collapse these round-trips; keep them separate until that write
            // is measured on a loaded tenant (same-row parallel updates would race).
            // Global `case_stale_check` should wait on the same loaded-tenant measurement
            // before collapsing the five UPDATEs.
            for (const { field, snapshot, intended, writeFlag } of casWrites) {
                const wrote = await this.#repository.updateColumnIfSnapshotMatches(field, id, snapshot, intended, trx);
                if (!wrote) {
                    // Dentro de la transacción: deshace también el `update` del caso y el
                    // `onBeforePersist` que ya corrieron en este mismo bloque.
                    if (requireSnapshotMatch.includes(field)) {
                        throw new StaleSnapshotWriteError(field);
                    }
                    writeOutcome[writeFlag] = true;
                    continue;
                }

                if (field === 'transicion_id') {
                    if (intended !== kase.transicion_id.value) {
                        kase.transicion_id = intended;
                        kase.state_change_at =
                            kase.changedAttributes.updated_at ?? kase.updated_at?.value ?? new Date().toISOString();
                        if (!('update_source' in dto)) {
                            kase.update_source = null;
                        }
                        persistCasSideFields = true;
                    }
                } else if (field === 'responsable_id') {
                    if (intended !== kase.responsable_id.value) {
                        kase.responsable_id = intended;
                        if (kase.changedAttributes.assignment_change_type === undefined) {
                            kase.assignment_change_type = ValueObjectAssignmentChangeType.MANUAL;
                        }
                        persistCasSideFields = true;
                    }
                } else if (intended !== kase[field]?.value) {
                    kase[field] = intended;
                }
            }

            if (persistCasSideFields) {
                const fullChanged = { ...kase.changedAttributes };
                const sideKeys = new Set([
                    'assignment_change_type',
                    'state_change_at',
                    'update_source',
                    'last_assigned_at',
                    'first_view_at',
                ]);
                for (const key of Object.keys(kase.changedAttributes)) {
                    if (!sideKeys.has(key)) {
                        delete kase.changedAttributes[key];
                    }
                }
                await this.#repository.update(kase, trx);
                Object.assign(kase.changedAttributes, fullChanged);
            }

            const trigger = kase.changedAttributes.transicion_id
                ? ActionTriggers.STATE_CHANGE
                : ActionTriggers.EDIT_CASE;

            await this.#repository.saveHistory(kase, originalValues, trx);
            return { writeOutcome, trigger };
        };

        const { writeOutcome, trigger } =
            typeof this.#repository.connection?.transaction === 'function'
                ? await this.#repository.connection.transaction(persistWrites)
                : await persistWrites();

        if (!skipSlaAndEvents) {
            await this.#calculateSLATimers(kase);
        }

        if (saveEventLog) {
            await this.#handleEventLogging(kase, originalValues);
        }

        if (!skipSlaAndEvents) {
            await this.#publishDomainEvents(kase, trigger);
        }

        kase.flushChanges();
        return writeOutcome;
    }

    /**
     * Calculates and updates SLA timers for the given case
     * This method handles ANS (Answer Time) calculations and updates the case with new SLA values
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

            await this.#repository.update(kaseForAns);
            await this.#repository.saveHistory(kaseForAns, originalValues);

            Helper.logInfo(`SLA timers updated successfully for case ${kase.id.value}`, 'SLA');
        } catch (error) {
            Helper.logError('Error calculating ANS after case update:', error);
        }
    }

    /**
     * Handles logging of specific events based on case changes.
     * @param {import('../../domain/Case.js').Case} kase - The updated case.
     * @param {Object} originalValues - The old values of case.
     */
    async #handleEventLogging(kase, originalValues) {
        const id = kase.id.value;
        const currentUser = kase.updated_by.value;
        const clientId = kase.cliente_id.value;

        if (kase.changedAttributes.transicion_id) {
            await this.eventLogger.log(
                'case.state_changed',
                id,
                currentUser,
                { transicion_id: kase.changedAttributes.transicion_id },
                id,
                clientId,
                { transicion_id: originalValues.transicion_id }
            );
            kase.flushChanges('transicion_id');
        }

        if (kase.changedAttributes.responsable_id) {
            await this.eventLogger.log(
                'case.responsible_changed',
                id,
                currentUser,
                {
                    responsable_id: kase.changedAttributes.responsable_id,
                },
                id,
                clientId,
                {
                    responsable_id: originalValues.responsable_id,
                    transicion_id: originalValues.transicion_id,
                }
            );
            kase.flushChanges('responsable_id');
        }

        if (kase.changedAttributes.fecha_resolucion) {
            await this.eventLogger.log(
                'case.closed',
                id,
                currentUser,
                {
                    fecha_resolucion: kase.changedAttributes.fecha_resolucion,
                    transicion_id: kase.transicion_id.value,
                },
                id,
                clientId,
                {
                    fecha_resolucion: originalValues.fecha_resolucion,
                    transicion_id: originalValues.transicion_id,
                }
            );
            kase.flushChanges('fecha_resolucion');
        }

        const relevantChanges = Object.keys(kase.changedAttributes).filter(
            (key) => key !== 'updated_at' && key !== 'updated_by' && key !== 'edited_at' && key !== 'edited_by'
        );

        if (relevantChanges.length > 0) {
            await this.eventLogger.log(
                'case.updated',
                id,
                currentUser,
                kase.changedAttributes,
                id,
                clientId,
                originalValues
            );
        }
    }

    /**
     * Records and publishes domain events based on case changes.
     * @param {import('../../domain/Case.js').Case} kase - The updated case
     * @param trigger
     * @private
     */
    async #publishDomainEvents(kase, trigger) {
        if (!this.#eventPublisher) {
            return;
        }

        try {
            kase.recordDomainEvent(
                new CaseUpdated({
                    caseId: kase.id.value,
                    changedAttributes: kase.changedAttributes,
                    trigger: trigger.value,
                    metadata: {
                        tenant_id: this.tenant.id.value,
                        user_id: this.#user.id.value,
                        correlation_id: null,
                        causation_id: null,
                    },
                })
            );

            const domainEvents = kase.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            Helper.logError('CaseUpdater: Failed to publish domain events', error);
        }
    }

    /**
     * `requireSnapshotMatch` solo puede nombrar columnas del catálogo `STALE_FIELDS`: son las
     * únicas que llegan a tener un CAS que pueda fallar. Un nombre mal escrito o no soportado no
     * encolaría ningún CAS y la obligación quedaría en nada, sin que nadie se enterara — así que
     * se rechaza de entrada, antes de tocar el caso, en vez de degradar en silencio.
     *
     * Es un error de programación del llamador, no del usuario: 500.
     *
     * @param {string[]} requireSnapshotMatch
     * @throws {CustomError}
     * @private
     */
    static #assertRequiredFieldsAreKnown(requireSnapshotMatch) {
        if (requireSnapshotMatch.length === 0) {
            return;
        }

        const known = new Set(STALE_FIELDS.map(({ field }) => field));
        const unknown = requireSnapshotMatch.filter((field) => !known.has(field));

        if (unknown.length > 0) {
            throw new CustomError(
                `requireSnapshotMatch contains fields that are not stale-checked: ${unknown.join(', ')}`,
                500
            );
        }
    }

    /**
     * Manages audit tracking fields based on account type.
     * @param {Object} dto
     * @returns {Object}
     * @private
     */
    #buildUpdatePayload(dto) {
        const payload = { ...dto };

        if (this.#user?.isServiceAccount) {
            delete payload.edited_by;
            delete payload.edited_at;
        } else if (this.#user && this.#user.id?.value) {
            payload.edited_by = this.#user.id.value;
            payload.edited_at = payload.updated_at ?? new Date().toISOString();
        }

        return payload;
    }
}
