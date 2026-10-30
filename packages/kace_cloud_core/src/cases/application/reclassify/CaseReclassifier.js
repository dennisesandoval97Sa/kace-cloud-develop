import { CustomError } from '../../../shared/errors/CustomError.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { CASE_RECLASSIFY_PERMISSION, ValueObjectUuid } from '../../../shared/index.js';
import { CommentCreator } from '../../../comments/application/create/CommentCreator.js';
import { CaseReclassificationEligibility } from './CaseReclassificationEligibility.js';
import { StaleSnapshotWriteError } from '../../domain/staleFields.js';
import { DeepMergeAuxiliariesData } from '../../../shared/domain/services/DeepMergeAuxiliariesData.js';

/**
 * CORE-1 (MSKT-1392) — mueve un caso ya persistido a otra clasificación.
 *
 * Reclasificar cambia tres cosas a la vez: el flujo (y con él los estados disponibles), el
 * SLA (vía el ANS de la clasificación) y el formulario OneScript que se renderiza. Por eso
 * NO basta con escribir `clasificacion_id`: hay que llegar con una transición del flujo
 * destino y con la garantía de que la clasificación tiene formulario para el grupo del caso,
 * o el asesor se queda con un formulario vacío que no puede diligenciar.
 *
 * La persistencia, el `state_change_at` y el recálculo de SLA se delegan en `CaseUpdater`,
 * que ya los resuelve para el resto de caminos.
 *
 * Las condiciones viven en `CaseReclassificationEligibility` para que el precheck responda
 * con el mismo código y el mismo mensaje que daría este POST.
 */
export class CaseReclassifier {
    #eligibility;
    #classificationsRepository;
    #caseUpdater;
    #eventLogger;
    #commentCreator;
    #folioResolver;
    #auxCasesFinderByCase;

    /**
     * @param {Object} dependencies
     * @param {import('../../infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} dependencies.caseRepository
     * @param {import('../../../classifications/infrastructure/persistence/KnexClassificationsRepository.js').KnexClassificationsRepository} dependencies.classificationsRepository
     * @param {import('../../../classification-group-relationships/infrastructure/persistence/KnexClassificationGroupRelationshipRepository.js').KnexClassificationGroupRelationshipRepository} dependencies.classificationGroupRelationshipRepository
     * @param {import('../../infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} dependencies.transitionsCaseRepository
     * @param {import('../../infrastructure/persistence/KnexSubcaseRelationshipRepository.js').KnexSubcaseRelationshipRepository} dependencies.subcaseRelationshipRepository
     * @param {() => Promise<object>} dependencies.getGlobalConfig - Ver `CaseReclassificationEligibility`.
     * @param {import('../update/CaseUpdater.js').CaseUpdater} dependencies.caseUpdater - Ya construido
     *   por el llamador con su usuario, publicador de eventos y tenant: así la inyección de
     *   esos tres (API-2) sigue siendo responsabilidad del Lambda y no de este caso de uso.
     * @param {import('../../../comments/infrastructure/persistence/KnexCommentsRepository.js').KnexCommentsRepository} [dependencies.commentsRepository]
     *   Necesario solo si se va a pasar un `comment` en `execute`.
     * @param {import('../folio/CaseFolioResolver.js').CaseFolioResolver} [dependencies.folioResolver]
     *   Si llega, un caso sin folio que se reclasifica a una clasificación con configuración de
     *   folio lo obtiene dentro de la transacción del guardado. Un caso con folio lo conserva.
     * @param {import('../../../aux_casos/domain/AuxCasesFinderByCase.js').AuxCasesFinderByCase} [dependencies.auxCasesFinderByCase]
     *   Lee `aux_cases.data` para las rutas aux_cases.* del folio. Solo se usa con `folioResolver`.
     */
    constructor({
        caseRepository,
        classificationsRepository,
        classificationGroupRelationshipRepository,
        transitionsCaseRepository,
        subcaseRelationshipRepository,
        getGlobalConfig,
        caseUpdater,
        commentsRepository,
        folioResolver = null,
        auxCasesFinderByCase = null,
    }) {
        this.#eligibility = new CaseReclassificationEligibility({
            caseRepository,
            classificationsRepository,
            classificationGroupRelationshipRepository,
            transitionsCaseRepository,
            subcaseRelationshipRepository,
            getGlobalConfig,
        });
        this.#classificationsRepository = classificationsRepository;
        this.#caseUpdater = caseUpdater;
        this.#eventLogger = new EventLogger(caseRepository);
        this.#commentCreator = commentsRepository ? new CommentCreator(commentsRepository) : null;
        this.#folioResolver = folioResolver;
        this.#auxCasesFinderByCase = auxCasesFinderByCase;
    }

    /**
     * @param {string} caseId
     * @param {Object} dto - `clasificacion_id` y `transicion_id` obligatorios; el resto se pasa
     *   tal cual a `CaseUpdater` (`grupo_id`, `responsable_id`, `updated_at`, `updated_by`…).
     * @param {Object} [options]
     * @param {string} [options.clasificacionSnapshot] - Clasificación que el formulario tenía
     *   cargada. Si no coincide con la persistida, la operación falla.
     * @param {{ descripcion: string }} [options.comment] - Motivo de la reclasificación. Se crea
     *   como comentario y el caso apunta a él con `cambio_estado_comentario_id`.
     * @param {Object|null} [options.pendingAuxData] - `aux_cases.data` que la misma petición va a
     *   guardar después de reclasificar (edición con auxiliar). El folio se genera con él encima
     *   del persistido, porque un radicado no se regenera.
     * @param {boolean} [options.overrideAuxArrays] - Igual que `?override=true` en AuxCasesUpdater.
     * @returns {Promise<Object>} `writeOutcome` de `CaseUpdater`.
     */
    async execute(caseId, dto, options = {}) {
        const { blocker, kase, classification } = await this.#eligibility.evaluate(caseId, {
            clasificacionId: dto.clasificacion_id,
            transicionId: dto.transicion_id,
            grupoId: dto.grupo_id,
            clasificacionSnapshot: options.clasificacionSnapshot,
        });

        if (blocker) {
            throw new CustomError(blocker.message, blocker.statusCode, [], blocker.code);
        }

        const previousClassificationId = kase.clasificacion_id.value;
        const commentId = this.#prepareMotivo(options.comment);

        const writeOutcome = await this.#persist(caseId, dto, commentId, options, previousClassificationId);

        // Post-commit: el caso YA está reclasificado. Un fallo aquí no puede devolver 500, porque
        // el cliente reintentaría y chocaría contra `CASE_RECLASSIFY_CLASSIFICATION_STALE` sin
        // salida. `EventLogger.log` ya traga sus propios errores, pero no los de armar el evento
        // —leer un ValueObject ausente lanza antes de entrar en él—, así que la guarda es aquí.
        try {
            await this.#logReclassified(kase, dto, previousClassificationId, commentId, classification);
        } catch (error) {
            Helper.logError('Error logging case reclassification:', error);
        }

        return writeOutcome;
    }

    /**
     * Escribe la reclasificación con bloqueo optimista sobre la clasificación.
     *
     * El snapshot NO es el que manda el cliente: es la clasificación que `evaluate` acaba de leer.
     * Así la ventana que cubre el CAS es la que de verdad importa —entre la lectura de
     * elegibilidad y la escritura—, y queda cubierta también cuando el cliente no manda
     * `current_clasificacion_id`, que el esquema permite omitir. El snapshot del cliente sigue
     * comprobándose antes, en `evaluate`, contra la ventana más larga que él sí conoce (desde que
     * cargó el formulario).
     *
     * El CAS es OBLIGATORIO: si no coincide, no vale degradar escribiendo la transición del flujo
     * destino sobre la clasificación vieja; se deshace la transacción entera y se devuelve el
     * mismo 409 que habría devuelto el pre-check.
     *
     * @param {string} caseId
     * @param {Object} dto
     * @param {string|null} commentId
     * @param {Object} options
     * @param {string|null} previousClassificationId
     * @returns {Promise<Object>}
     */
    async #persist(caseId, dto, commentId, options, previousClassificationId) {
        const folioOptions = await this.#folioOptions(caseId, options);

        try {
            return await this.#caseUpdater.execute(
                caseId,
                {
                    ...dto,
                    cambio_clasificacion: true,
                    // Va DENTRO del dto —y no en una escritura aparte— para que viaje en la misma
                    // transacción que `CaseUpdater` ya abre y quede en `history_cases.changed_attributes`,
                    // que es de donde el timeline de transiciones lee.
                    ...(commentId ? { cambio_estado_comentario_id: commentId } : {}),
                },
                true,
                {
                    // `CaseReclassify` es el único gate: no exige ser responsable ni
                    // `CaseUpdateNotOwner`. Se declara aquí para que `CaseUpdater` lo compruebe él
                    // mismo, en vez de quedarse sin autorización fiándolo todo al Lambda.
                    requiredPermission: CASE_RECLASSIFY_PERMISSION,
                    clasificacionSnapshot: previousClassificationId,
                    requireSnapshotMatch: ['clasificacion_id'],
                    ...folioOptions,
                    ...(commentId
                        ? { onBeforePersist: (trx) => this.#createMotivo(commentId, caseId, dto, options.comment, trx) }
                        : {}),
                }
            );
        } catch (error) {
            if (error instanceof StaleSnapshotWriteError) {
                const blocker = CaseReclassificationEligibility.classificationStaleBlocker();
                throw new CustomError(blocker.message, blocker.statusCode, [], blocker.code);
            }
            throw error;
        }
    }

    /**
     * Opciones de folio para `CaseUpdater`: vacías si no se inyectó `folioResolver`, así que la
     * reclasificación sin folio configurable se comporta exactamente igual que antes.
     *
     * El auxiliar es el final: el persistido, leído sin `EntityCache` (dura 5 minutos y solo se
     * invalida en el proceso que escribe), con los cambios que la petición va a guardar encima,
     * fusionados igual que los fusiona `AuxCasesUpdater`.
     *
     * @param {string} caseId
     * @param {Object} options - ver `execute`
     * @returns {Promise<Object>}
     */
    async #folioOptions(caseId, { pendingAuxData = null, overrideAuxArrays = false } = {}) {
        if (!this.#folioResolver) {
            return {};
        }

        const auxCase = this.#auxCasesFinderByCase
            ? await this.#auxCasesFinderByCase.execute(caseId, { skipCache: true })
            : null;
        const persisted = auxCase?.data?.value ?? {};
        const auxData = pendingAuxData
            ? DeepMergeAuxiliariesData.execute(persisted, pendingAuxData, overrideAuxArrays)
            : persisted;

        return { folioResolver: this.#folioResolver, auxData };
    }

    /**
     * Reserva el id del motivo antes de escribir nada: el caso lo referencia con
     * `cambio_estado_comentario_id`, así que tiene que viajar ya en el dto que recibe
     * `CaseUpdater`. La fila se inserta después, dentro de su transacción.
     *
     * Validar aquí la dependencia que falta —y no al insertar— hace que un llamador mal
     * construido falle antes de tocar la base de datos.
     *
     * @param {{ descripcion: string }} [comment]
     * @returns {string|null} Id reservado, o `null` si no hay motivo.
     */
    #prepareMotivo(comment) {
        if (!comment) {
            return null;
        }
        if (!this.#commentCreator) {
            throw new CustomError('CaseReclassifier: commentsRepository is required to store a comment', 500);
        }

        return ValueObjectUuid.random();
    }

    /**
     * Inserta el motivo DENTRO de la transacción del caso, vía `onBeforePersist`, y antes de la
     * escritura del caso porque éste ya apunta a esa fila.
     *
     * Antes se creaba fuera: si la escritura del caso fallaba después, quedaba un comentario
     * huérfano al que nada apuntaba. Ahora las dos escrituras viven o mueren juntas.
     *
     * @param {string} id - Id reservado por `#prepareMotivo`.
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async #createMotivo(id, caseId, dto, comment, trx) {
        await this.#commentCreator.execute(
            {
                id,
                descripcion: comment.descripcion,
                // Sin valoración: el motivo no sale de una encuesta de satisfacción.
                calificacion: null,
                caso_id: caseId,
                created_at: dto.updated_at ?? new Date(),
                created_by: dto.updated_by ?? null,
            },
            trx
        );
    }

    /**
     * CORE-3 — evento propio de la bitácora. Va aparte del `case.updated` / `case.state_changed`
     * que `CaseUpdater` ya emite: aquellos cuentan QUÉ campos cambiaron, éste cuenta que lo que
     * ocurrió fue una reclasificación, con su motivo.
     *
     * AUD-1 — la etiqueta de cada clasificación se registra AQUÍ porque `EventLogger` solo sabe
     * resolver transiciones, usuarios y flujos. Queda congelada en el evento: si la clasificación
     * se renombra después, la bitácora debe seguir contando lo que el asesor vio ese día.
     *
     * @param {import('../../../classifications/domain/Classification.js').Classification} targetClassification
     *   La destino, que `evaluate` ya cargó para decidir la elegibilidad.
     */
    async #logReclassified(kase, dto, previousClassificationId, commentId, targetClassification) {
        const previousClassification = await this.#findClassification(previousClassificationId);

        await this.#eventLogger.log(
            'case.reclassified',
            kase.id.value,
            dto.updated_by ?? kase.updated_by?.value ?? kase.created_by.value,
            {
                clasificacion_id: dto.clasificacion_id,
                clasificacion: CaseReclassifier.#describeClassification(targetClassification),
                transicion_id: dto.transicion_id,
                cambio_estado_comentario_id: commentId ?? null,
            },
            kase.id.value,
            kase.cliente_id.value,
            {
                clasificacion_id: previousClassificationId,
                clasificacion: CaseReclassifier.#describeClassification(previousClassification),
                transicion_id: kase.transicion_id.value,
                cambio_estado_comentario_id: kase.cambio_estado_comentario_id?.value ?? null,
            }
        );
    }

    /**
     * La bitácora no es motivo para tumbar una reclasificación ya escrita: si la clasificación
     * anterior no se puede leer, el evento sale con el id y sin etiqueta.
     */
    async #findClassification(classificationId) {
        try {
            return await this.#classificationsRepository.find(
                new ValueObjectUuid('clasificacion_id', classificationId)
            );
        } catch {
            return null;
        }
    }

    static #describeClassification(classification) {
        if (!classification) return null;

        return { id: classification.id.value, label: classification.label };
    }
}
