import { BaseController, hasCaseReclassifyPermission, HttpResponse } from '@kace/api-common';
import {
    CaseReclassificationEligibility,
    ClassificationFlowStatesFinder,
    ClassificationFlowTransitionRulesFinder,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
} from '@kace/core/src/cases';
import { KnexTransitionsCaseRepository } from '@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexClassificationGroupRelationshipRepository } from '@kace/core/src/classification-group-relationships';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Responde si un caso puede moverse a una clasificación destino y con qué estados se
 * encontraría allí. `POST /transitions/search` no puede darlo: no admite filtrar por
 * `is_visible`, exige `TransitionsRead` de `administrador` —que un asesor no tiene— y no joinea
 * `estados` para traer los nombres.
 *
 * Consume el mismo `CaseReclassificationEligibility` que `CaseReclassifier`, así que ambos
 * aplican las mismas reglas y devuelven el mismo código. No es una promesa de que el POST vaya a
 * aceptar lo que aquí salga elegible: este servicio lee de la réplica y el POST valida contra el
 * primary, y además el POST comprueba el snapshot de concurrencia, que aquí no existe.
 */
export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Objetos de configuración, no `this.database_connection`: pasar una instancia Knex ya
        // construida colapsa el lector sobre el escritor en silencio.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexCaseRepository(knexConfig, readerConfig);
        this.classificationsRepository = new KnexClassificationRepository(knexConfig, readerConfig);
        this.classificationGroupRelationshipRepository = new KnexClassificationGroupRelationshipRepository(
            knexConfig,
            readerConfig
        );
        this.transitionsCaseRepository = new KnexTransitionsCaseRepository(knexConfig, readerConfig);
        // No admite `readerConfig`, así que sus lecturas se quedan en el escritor igualmente;
        // reusa el pool ya abierto para no abrir otro.
        this.subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(this.repository.connection);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.classificationsRepository.destroyConnection();
        await this.classificationGroupRelationshipRepository.destroyConnection();
        await this.transitionsCaseRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    /**
     * `GET /{id}?clasificacion_id=<uuid>`
     *
     * El estado separa que la pregunta no se pueda formular (caso o clasificación inexistentes
     * → 404) de que la respuesta sea "no" (→ 200 con `eligible: false` y el código público): un
     * bloqueo de negocio es una respuesta válida, y el plugin necesita leer el motivo en vez de
     * capturar una excepción.
     */
    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            if (!hasCaseReclassifyPermission(this.user)) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const clasificacionId = this.event.queryStringParameters?.clasificacion_id;
            if (!this.validateId(clasificacionId)) {
                return HttpResponse.badRequest({
                    message: 'Invalid clasificacion_id',
                    event: this.event,
                });
            }

            const { eligible, blocker, classification } = await this.#eligibility().evaluate(id, { clasificacionId });

            if (blocker?.statusCode === 404) {
                return HttpResponse.notFound({
                    message: blocker.message,
                    event: this.event,
                    code: blocker.code,
                });
            }

            if (!eligible) {
                return HttpResponse.ok({
                    data: {
                        eligible: false,
                        blocker: { code: blocker.code, message: blocker.message },
                        states: [],
                        transition_rules: [],
                    },
                    event: this.event,
                });
            }

            const states = await new ClassificationFlowStatesFinder(
                this.classificationsRepository,
                this.transitionsCaseRepository
            ).executeForClassification(classification);

            // Las reglas viajan junto a los estados para que el plugin anticipe el bloqueo —avisar
            // antes de elegir un estado que la regla va a rechazar— en vez de descubrirlo al
            // guardar. Van indexadas por `transicion_id`, que es lo que la lista de estados publica.
            const transitionRules = await new ClassificationFlowTransitionRulesFinder(
                this.transitionsCaseRepository
            ).executeForClassification(classification);

            return HttpResponse.ok({
                data: {
                    eligible: true,
                    blocker: null,
                    states: states.toJson().data.items,
                    transition_rules: transitionRules,
                },
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    #eligibility() {
        return new CaseReclassificationEligibility({
            caseRepository: this.repository,
            classificationsRepository: this.classificationsRepository,
            classificationGroupRelationshipRepository: this.classificationGroupRelationshipRepository,
            transitionsCaseRepository: this.transitionsCaseRepository,
            subcaseRelationshipRepository: this.subcaseRelationshipRepository,
            getGlobalConfig: () => this.getGlobalConfig(),
            replicaSafeCaseRead: true,
        });
    }
}
