import { BaseController, HttpResponse } from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { UserUpdater } from '@kace/core/src/users/index.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { EntityActionExecutionServiceFactory } from '@kace/core/src/actions/infrastructure/EntityActionExecutionServiceFactory.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships/infrastructure/persistence/KnexUserGroupRelationshipRepository.js';
import { UserGroupFinder as DomainUserGroupFinder } from '@kace/core/src/user-group-relationships/domain/UserGroupFinder.js';
import { updateActiveGroupSchema } from './schemas.js';

export default class ControllerUpdateActiveGroup extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexUsersRepository(knexConfig, readerConfig);
        this.userGroupRepository = new KnexUserGroupRelationshipRepository(knexConfig, readerConfig);
        this.started_at = new Date();
        this.actionExecutionService = EntityActionExecutionServiceFactory.create(this.repository);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.userGroupRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate (update-active-group)');
        try {
            const id = this.user.id.value;

            const data = updateActiveGroupSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            // The active group drives the user's configuration, so only a group the user belongs to
            // is accepted: 404 when it does not exist, 403 when the user is not a member.
            const userGroupFinder = new DomainUserGroupFinder(this.userGroupRepository);
            await assertAuthorizedRelationships({
                payload: data.value,
                repository: this.repository,
                actorId: id,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /users/update-active-group',
                resourceType: 'users',
                relationships: [
                    {
                        field: 'grupo_activo',
                        table: 'grupos',
                        authorize: async (group) => Boolean(await userGroupFinder.execute(id, group.id)),
                    },
                ],
            });

            const dto = {
                ...data.value,
                updated_at: this.started_at,
                updated_by: id,
            };

            await new UserUpdater(this.repository, this.actionExecutionService).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionCreate (update-active-group)', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate (update-active-group)');
        }
    }
}
