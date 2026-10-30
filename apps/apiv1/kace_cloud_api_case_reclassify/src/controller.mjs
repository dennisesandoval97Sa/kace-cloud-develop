import { applyServerManagedFields, BaseController, hasCaseReclassifyPermission, HttpResponse } from '@kace/api-common';
import { caseReclassifySchema } from './schemas.mjs';
import {
    CaseReclassifier,
    CaseUpdater,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
} from '@kace/core/src/cases';
import { KnexTransitionsCaseRepository } from '@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexClassificationGroupRelationshipRepository } from '@kace/core/src/classification-group-relationships';
import { KnexCommentsRepository } from '@kace/core/src/comments';
import { KnexFolioConfigurationRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { CaseFolioResolver } from '@kace/core/src/cases/application/folio/CaseFolioResolver.js';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { AuxCasesFinderByCase } from '@kace/core/src/aux_casos/domain/AuxCasesFinderByCase.js';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Reclasificar exige el permiso `CaseReclassify` (aquí y en `CaseUpdater`) Y el flag global
 * `allow_case_reclassification` (en `CaseReclassificationEligibility`).
 */
export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        this.commentsRepository = new KnexCommentsRepository(this.database_connection);
        this.transitionsCaseRepository = new KnexTransitionsCaseRepository(this.database_connection);
        this.transitionRuleRepository = new KnexTransitionRuleRepository(this.database_connection);
        this.classificationsRepository = new KnexClassificationRepository(this.database_connection);
        this.classificationGroupRelationshipRepository = new KnexClassificationGroupRelationshipRepository(
            this.database_connection
        );
        this.subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(this.database_connection);
        this.started_at = new Date();

        this.actionExecutionService = this.getActionExecutionService(this.repository, this.database_connection);

        // Reclassifying into a classification that has a folio configuration gives the
        // case a folio, but only if it does not have one yet: a radicado is never regenerated.
        this.auxCasesFinderByCase = new AuxCasesFinderByCase(new KnexAuxCasesRepository(this.database_connection));
        this.caseFolioResolver = new CaseFolioResolver(
            new KnexFolioConfigurationRepository(this.database_connection),
            new KnexFolioSequenceRepository(this.database_connection)
        );
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            if (!hasCaseReclassifyPermission(this.user)) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
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
            const payload = applyServerManagedFields(this.payload(), {
                operation: 'update',
                userId: this.user.id.value,
                now: this.started_at,
            });
            const { value: body, error } = caseReclassifySchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            // Lo único que `CaseReclassifier` no valida.
            if (body.grupo_id || body.responsable_id) {
                await this.#ensureResponsableId(body.grupo_id, body.responsable_id);
            }

            // Ninguno de los dos es un atributo del agregado.
            const { comment, current_clasificacion_id: clasificacionSnapshot, ...dataUpdate } = body;
            // El motivo lo crea `CaseReclassifier`, no este controlador: su id tiene que entrar en
            // el dto para que el caso lo enlace en la misma escritura.
            await this.#buildReclassifier().execute(id, dataUpdate, { clasificacionSnapshot, comment });

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);

            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    /**
     * Sin user, eventPublisher y tenant, `CaseUpdated` no se publica y el event_processor nunca
     * ejecuta las acciones automatizadas del destino: falla en verde y en silencio. Por eso
     * `CaseReclassifier` recibe el `CaseUpdater` ya construido.
     */
    #buildReclassifier() {
        const caseUpdater = new CaseUpdater(
            this.repository,
            this.actionExecutionService,
            this.user,
            this.eventPublisher,
            this.tenant,
            this.transitionRuleRepository,
            this.transitionsCaseRepository
        );

        return new CaseReclassifier({
            caseRepository: this.repository,
            classificationsRepository: this.classificationsRepository,
            classificationGroupRelationshipRepository: this.classificationGroupRelationshipRepository,
            transitionsCaseRepository: this.transitionsCaseRepository,
            subcaseRelationshipRepository: this.subcaseRelationshipRepository,
            getGlobalConfig: () => this.getGlobalConfig(),
            caseUpdater,
            commentsRepository: this.commentsRepository,
            folioResolver: this.caseFolioResolver,
            auxCasesFinderByCase: this.auxCasesFinderByCase,
        });
    }

    async #ensureResponsableId(groupId, userId) {
        if (!groupId || !userId) {
            throw new CustomError('Both groupId and userId must be provided', 400);
        }
        await this.#ensureGroupRelationship(groupId);
        const relation = await this.repository
            .connection(this.repository.qualifiedName('rel_usuarios_grupos'))
            .select('*')
            .where({ usuario_id: userId, grupo_id: groupId })
            .first();

        if (!relation) {
            throw new CustomError('The user is not in the selected group', 404);
        }
    }

    async #ensureGroupRelationship(groupId) {
        const group = await this.repository
            .connection(this.repository.qualifiedName('grupos'))
            .select('id')
            .where({ id: groupId })
            .first();

        if (!group) {
            throw new CustomError('Group not found', 404);
        }
    }
}
