import { BaseController, HttpResponse } from '@kace/api-common';
import { schemaBulkAssign } from './schemas.mjs';
import { CaseBulkAssigner, KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships/index.js';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config/index.js';
import { AssignationService } from '@kace/core/src/shared/assignation/AssignationService.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import {
    AUTHORIZATION_ERROR,
    CASE_BULK_ASSIGNMENT_PARTIAL,
    CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
} from '@kace/error-codes';

export class BulkAssignController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.casesRepository = new KnexCaseRepository(knexConfig);
        this.usersRepository = new KnexUsersRepository(knexConfig);
        this.groupsRepository = new KnexGroupsRepository(knexConfig);
        this.userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(knexConfig);
        this.globalConfigRepository = new KnexGlobalConfigurationRepository(knexConfig);
        this.assignationService = new AssignationService(
            this.groupsRepository,
            this.globalConfigRepository,
            this.usersRepository
        );
    }

    async actionCreate() {
        Helper.logInfo('Begin BulkAssign');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesBulkAssign');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to assign users to cases.',
                    event: this.event,
                    code: AUTHORIZATION_ERROR,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaBulkAssign.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const result = await new CaseBulkAssigner(
                this.casesRepository,
                this.usersRepository,
                this.groupsRepository,
                this.userGroupRelationshipRepository,
                this.user,
                this.assignationService
            ).execute(value.case_ids, value.group_id, value.responsible_id, value.update_source);

            // result is null for the legacy path (explicit responsible_id provided);
            // it is { assigned, skipped } when AssignationService resolved the responsible.
            // Expose counts, skipped case IDs (for frontend selection logic) and references (for user display).
            const totalFailure = Boolean(result && result.assigned.length === 0 && result.skipped.length > 0);
            const hasPartialSkip = Boolean(result?.skipped?.length > 0 && !totalFailure);
            const publicCode = totalFailure
                ? CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE
                : hasPartialSkip
                  ? CASE_BULK_ASSIGNMENT_PARTIAL
                  : undefined;
            return HttpResponse.ok({
                event: this.event,
                data: publicCode ? { code: publicCode } : {},
                metadata: result
                    ? {
                          assignedCount: result.assigned.length,
                          skippedCount: result.skipped.length,
                          skippedIds: result.skipped.map((s) => s.caseId),
                          skippedReferences: result.skipped.map((s) => s.reference),
                      }
                    : null,
                code: publicCode,
            });
        } catch (error) {
            Helper.logError('BulkAssignController error', error);
            if (error instanceof CustomError) {
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
            Helper.logInfo('End BulkAssign');
        }
    }
}
