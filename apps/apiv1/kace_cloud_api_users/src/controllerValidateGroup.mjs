import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships/infrastructure/persistence/KnexUserGroupRelationshipRepository.js';
import { UserGroupFinder as DomainUserGroupFinder } from '@kace/core/src/user-group-relationships/domain/UserGroupFinder.js';
import { GroupsFinder as DomainGroupsFinder } from '@kace/core/src/grupos/domain/GroupsFinder.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { UserUpdater } from '@kace/core/src/users/application/update/UserUpdater.js';
import { ValidateActiveGroupMembership } from '@kace/core/src/users/application/validate-active-group/ValidateActiveGroupMembership.js';
import { validateGroupQuerySchema } from './schemas.js';

export default class ControllerValidateGroup extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.event = event;
        const { readerConfig } = this.event.tenantContext;
        this.userGroupRepository = new KnexUserGroupRelationshipRepository(knexConfig, readerConfig);
        this.groupsRepository = new KnexGroupsRepository(knexConfig, readerConfig);
        this.usersRepository = new KnexUsersRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.userGroupRepository.destroyConnection();
        await this.groupsRepository.destroyConnection();
        await this.usersRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logDebug('Begin actionValidateGroup');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to access this resource.',
                    event: this.event,
                });
            }

            const queryParams = this.event.queryStringParameters ?? {};
            const { error, value } = validateGroupQuerySchema.validate(queryParams);

            if (error) {
                return HttpResponse.ok({
                    message: 'Invalid or missing group_id',
                    data: { belongs_to_group: false, current_grupo_activo: this.user.grupo_activo?.value ?? null },
                    event: this.event,
                });
            }

            const userId = this.user.id.value;
            const requestedGroupId = value.group_id;
            const backendGroupId = this.user.grupo_activo?.value ?? null;

            const domainUserGroupFinder = new DomainUserGroupFinder(this.userGroupRepository);
            const domainGroupsFinder = new DomainGroupsFinder(this.groupsRepository);
            // No actionExecutionService: session heal must not fire UPDATE_USER side effects.
            const userUpdater = new UserUpdater(this.usersRepository);

            const result = await new ValidateActiveGroupMembership({
                findRelationship: (id, groupId) => domainUserGroupFinder.execute(id, groupId),
                findGroup: (groupId) => domainGroupsFinder.execute(groupId),
                clearActiveGroup: (id) =>
                    userUpdater.execute(id, {
                        grupo_activo: null,
                        updated_at: this.started_at,
                        updated_by: id,
                    }),
            }).execute({
                userId,
                groupId: requestedGroupId,
                currentGrupoActivo: backendGroupId,
            });

            return HttpResponse.ok({
                message: `Group membership validated for user ${userId}`,
                data: result,
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error in actionValidateGroup', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logDebug('End actionValidateGroup');
        }
    }
}
