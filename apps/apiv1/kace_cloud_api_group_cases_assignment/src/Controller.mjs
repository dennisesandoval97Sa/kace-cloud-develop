import { AssignCasesGroup } from './GroupSchema.mjs';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { CaseGroupAssigner } from '@kace/core/src/cases/application/assign/CaseGroupAssigner';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { AssignationService } from '@kace/core/src/shared/assignation/AssignationService.js';
import { HttpResponse, BaseController } from '@kace/api-common';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { KnexUsersRepository } from '@kace/core/src/users';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
export class Controller extends BaseController {
    #casesRepository; /** is initialized in the constructor */
    #assignationService; /** is initialized in the constructor */
    #globalConfigRepository; /** is initialized in the constructor */
    #userRepository; /** is initialized in the constructor */

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexGroupsRepository(this.database_connection);
        this.#casesRepository = new KnexCaseRepository(this.database_connection);
        this.#globalConfigRepository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.#userRepository = new KnexUsersRepository(this.database_connection);
        this.#assignationService = new AssignationService(
            this.repository,
            this.#globalConfigRepository,
            this.#userRepository
        );
        this.started_at = new Date();
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsUpdate');
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
            const data = AssignCasesGroup.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            if (id) {
                await this.#ensureGroupRelationship(id);
            }

            const assigner = new CaseGroupAssigner(this.#casesRepository, this.#assignationService, this.user);
            const assigned = [];
            const failed = [];
            let firstError = null;

            for (const caseId of payload.cases) {
                try {
                    await assigner.execute(caseId, id, payload.cases);
                    assigned.push(caseId);
                } catch (caseError) {
                    if (!firstError) firstError = caseError;
                    failed.push({
                        caseId,
                        code: caseError.publicErrorCode ?? null,
                        reason: caseError instanceof CustomError ? 'not_found_or_unavailable' : 'unexpected_error',
                    });
                }
            }

            if (assigned.length === 0 && firstError) {
                throw firstError;
            }

            return HttpResponse.ok({
                event: this.event,
                metadata: {
                    assignedCount: assigned.length,
                    failedCount: failed.length,
                    ...(failed.length > 0 ? { failed } : {}),
                },
            });
        } catch (error) {
            Helper.logError('GroupCasesAssignment error', error);
            if (error instanceof CustomError) {
                if (error.statusCode === 404) {
                    return HttpResponse.notFound({
                        message: error.message,
                        event: this.event,
                        code: error.publicErrorCode,
                    });
                }
                if (error.statusCode === 400) {
                    return HttpResponse.badRequest({
                        message: error.message,
                        event: this.event,
                        code: error.publicErrorCode,
                    });
                }
                return HttpResponse.custom(error.message, error.statusCode, this.event, error.publicErrorCode);
            }
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
            Helper.logInfo('End actionUpdate');
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
