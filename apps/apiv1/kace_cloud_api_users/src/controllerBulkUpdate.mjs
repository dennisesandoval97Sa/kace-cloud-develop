import { BaseController, HttpResponse } from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { ValidationFailError } from '@kace/core/src/shared/errors/ValidationFailError.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { KnexUsersRepository, UserBulkUpdater } from '@kace/core/src/users/index.js';
import { bulkUpdateUsersSchema } from './schemas.js';
import { USER_RELATIONSHIP_RULES } from './userRelationships.mjs';

export default class ControllerBulkUpdate extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexUsersRepository(this.database_connection);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate (bulk-update-users)');
        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'users', 'UsersUpdate');
            if (!hasAdminPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = bulkUpdateUsersSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const dto = {
                ...data.value.data,
                updated_at: this.started_at,
                updated_by: this.user.id.value,
            };

            await assertAuthorizedRelationships({
                payload: data.value.data,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /users/bulk-update',
                resourceType: 'users',
                relationships: USER_RELATIONSHIP_RULES,
            });

            await new UserBulkUpdater(this.repository).execute(data.value.user_ids, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionCreate (bulk-update-users)', error);
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate (bulk-update-users)');
        }
    }
}
