import { BaseController, HttpResponse } from '@kace/api-common';
import { caseCloneSchema } from './schemas.mjs';
import { CaseCloner, KnexCaseRepository } from '@kace/core/src/cases';
import { CommentCreator, KnexCommentsRepository } from '@kace/core/src/comments';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos';
import { AuxDefinitionDataStructureFinder } from '@kace/core/src/aux_definitions/application/find/AuxDefinitionDataStructureFinder';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { KnexFolioConfigurationRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { CaseFolioResolver } from '@kace/core/src/cases/application/folio/CaseFolioResolver.js';

import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        this.commentsRepository = new KnexCommentsRepository(this.database_connection);
        this.auxCasesRepository = new KnexAuxCasesRepository(this.database_connection);
        this.auxDataStructureFinder = new AuxDefinitionDataStructureFinder(
            new KnexAuxDefinitionsRepository(this.database_connection),
            new KnexSchemasRepository(this.database_connection)
        );
        /*
         * Built on the pool this controller already owns, like case_reclassify: a config object
         * would open two more pools per invocation that run() never closes.
         */
        this.caseFolioResolver = new CaseFolioResolver(
            new KnexFolioConfigurationRepository(this.database_connection),
            new KnexFolioSequenceRepository(this.database_connection)
        );
        this.started_at = new Date();
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CaseClone');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
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

            const payload = this.payload();
            const { value: body, error } = caseCloneSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (body.transicion_id) {
                await this.#ensureTransitionRelationship(body.transicion_id);
            }
            if (body.grupo_id || body.responsable_id) {
                await this.#ensureResponsableId(body.grupo_id, body.responsable_id);
            }

            const { comment, ...dataUpdate } = body;
            await new CaseCloner(
                this.repository,
                this.auxCasesRepository,
                this.auxDataStructureFinder,
                new CommentCreator(this.commentsRepository),
                this.caseFolioResolver
            ).execute(id, dataUpdate, this.user.id.value, comment && { ...comment, created_at: this.started_at });

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

    async #ensureTransitionRelationship(transitionId) {
        const transitions = await this.repository
            .connection(this.repository.qualifiedName('transiciones'))
            .select('id')
            .where({ id: transitionId })
            .first();

        if (!transitions) {
            throw new CustomError('Transition not found', 404);
        }
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
