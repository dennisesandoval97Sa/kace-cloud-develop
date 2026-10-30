import { BaseController, HttpResponse } from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { CaseUserAssigner } from '@kace/core/src/cases/application/assign/CaseUserAssigner.js';
import { Schema } from './Schema.mjs';
import { KnexUsersRepository } from '@kace/core/src/users';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.casesRepository = new KnexCaseRepository(this.database_connection);
        this.usersRepository = new KnexUsersRepository(knexConfig, readerConfig);
        this.groupsRepository = new KnexGroupsRepository(this.database_connection);
    }

    async destroyDbConnection() {
        await this.usersRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'user-cases-assigment',
                'UserCasesAssigmentCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to assign users to cases.',
                    event: this.event,
                });
            }

            const data = Schema.validate(this.payload(), { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await assertAuthorizedRelationships({
                payload: data.value,
                repository: this.casesRepository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /user-cases-assignment',
                resourceType: 'user_cases_assignment',
                relationships: [
                    { field: 'id', table: 'cases', notDeleted: false },
                    { field: 'grupo_id', table: 'grupos', notDeleted: false },
                    { field: 'responsable_id', table: 'usuarios', notDeleted: false },
                ],
            });

            const service = new CaseUserAssigner(
                this.casesRepository,
                this.usersRepository,
                this.groupsRepository,
                this.user
            );
            await service.execute(
                data.value.id,
                data.value.grupo_id,
                data.value.responsable_id,
                data.value.update_source
            );

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
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
