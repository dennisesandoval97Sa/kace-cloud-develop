import { BaseController, HttpResponse } from '@kace/api-common';
import { casoReOpenSchema } from './schemas.mjs';
import { CaseReopener, KnexCaseRepository } from '@kace/core/src/cases';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { KnexCommentsRepository } from '@kace/core/src/comments';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';

const COMMENT_RATING_REOPEN = 4;

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        // Reuse the writer already opened by BaseController so destroyDbConnection()
        // closes a single pool. This is a write endpoint; reads share the primary.
        this.groupsRepository = new KnexGroupsRepository(this.database_connection);
        this.globalConfigurationRepository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.commentsRepository = new KnexCommentsRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CaseReOpen');
            if (!hasPermission) {
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

            const payload = this.payload();
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;
            const { value: body, error } = casoReOpenSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { comment: commentBody, cambio_estado_comentario_id, ...dataUpdate } = body;
            const comment = commentBody
                ? {
                      ...commentBody,
                      id: ValueObjectUuid.random(),
                      created_at: this.started_at,
                      created_by: this.user.id.value,
                      calificacion: COMMENT_RATING_REOPEN,
                  }
                : undefined;

            const payloadAlter = {
                ...dataUpdate,
                ...(cambio_estado_comentario_id ? { cambio_estado_comentario_id } : {}),
                fecha_resolucion: null,
                motivo_baja: null,
                reopen_at: this.started_at,
                reopen_by: this.user.id.value,
            };
            if (!this.user?.isServiceAccount) {
                payloadAlter.edited_at = this.started_at;
                payloadAlter.edited_by = this.user.id.value;
            }
            const reOpenCase = new CaseReopener(
                this.repository,
                this.groupsRepository,
                this.globalConfigurationRepository,
                this.commentsRepository
            );
            await reOpenCase.execute(id, payloadAlter, {
                userGroupId: this.user.grupo_activo.value,
                comment,
            });

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const isExpectedDomainError = error?.statusCode >= 400 && error.statusCode < 500;
            if (isExpectedDomainError) {
                Helper.logInfo(`actionUpdate rejected: ${error.message}`);
            } else {
                Helper.logError('actionUpdate failed', error);
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }
}
