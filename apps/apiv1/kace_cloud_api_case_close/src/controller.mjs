import { BaseController, HttpResponse } from '@kace/api-common';
import { caseCloseSchema } from './schemas.mjs';
import { CaseCloser, KnexCaseRepository } from '@kace/core/src/cases';
import { CommentCreator, KnexCommentsRepository } from '@kace/core/src/comments';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { KnexSubcaseRelationshipRepository } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        this.groupsRepository = new KnexGroupsRepository(this.database_connection);
        this.globalConfigurationRepository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(this.database_connection);

        this.commentsRepository = new KnexCommentsRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CaseClose');
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
            const { value: body, error } = caseCloseSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { comment, ...dataUpdate } = body;
            dataUpdate.updated_by = this.user.id.value;
            dataUpdate.updated_at = this.started_at;
            if (!this.user?.isServiceAccount) {
                dataUpdate.edited_by = this.user.id.value;
                dataUpdate.edited_at = this.started_at;
            }
            await new CaseCloser(
                this.repository,
                this.groupsRepository,
                this.globalConfigurationRepository,
                this.subcaseRelationshipRepository
            ).execute(id, dataUpdate);

            if (dataUpdate.motivo_baja) {
                await new CommentCreator(this.commentsRepository).execute({
                    id: crypto.randomUUID(),
                    descripcion: dataUpdate.motivo_baja,
                    caso_id: id,
                    created_at: this.started_at,
                    created_by: this.user.id.value,
                });
            }

            if (comment) {
                comment.created_at = this.started_at;
                comment.created_by = this.user.id.value;
                comment.caso_id = id;
                await new CommentCreator(this.commentsRepository).execute(comment);
            }

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
}
