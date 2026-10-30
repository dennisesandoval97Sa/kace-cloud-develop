import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    applyServerManagedFields,
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import {
    CaseSessionDurationCreator,
    KnexCaseSessionDurationRepository,
} from '@kace/core/src/case_session_durations/index.js';
import { CaseSessionDurationCreateSchema, CaseSessionDurationUpdateSchema } from './CaseSessionDurationSchema.mjs';
import { CaseSessionDurationUpdater } from '@kace/core/src/case_session_durations/application/update/CaseSessionDurationUpdater.js';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { CaseSessionDurationResponse } from '@kace/core/src/case_session_durations/application/CaseSessionDurationResponse.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Satellite repo serves read endpoints (search/count/actionSearch) → wire the reader (pass
        // CONFIG objects, not this.database_connection, §8.1 footgun). The cases aggregate repo stays
        // on the writer (cases is priority:true and its reads are write-path guards).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexCaseSessionDurationRepository(knexConfig, readerConfig);
        this.casesRepository = new KnexCaseRepository(this.database_connection);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            let payload = applyServerManagedFields(this.payload());
            const identity = await resolveCanonicalCreateIdentity({
                payload,
                allowLegacyId: false,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /case_session_duration',
                resourceType: 'case_session_durations',
            });
            payload = identity.payload;

            const { error, value: dto } = CaseSessionDurationCreateSchema.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await assertAuthorizedRelationships({
                payload: dto,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /case_session_duration',
                resourceType: 'case_session_durations',
                relationships: [{ field: 'case_id', table: 'cases', required: true }],
            });

            // Transform API payload (camelCase) into domain DTO (snake_case) expected by the domain
            dto.started_at = this.started_at.toISOString();
            dto.user_id = this.user.id.value;
            dto.created_at = this.started_at.toISOString();
            dto.created_by = this.user.id.value;

            const creator = new CaseSessionDurationCreator(this.repository, this.casesRepository);
            const result = await creator.execute(dto);
            return HttpResponse.created({ ...result.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const caseSessionDurationId = this.pathParameters().id;
            if (!this.validateId(caseSessionDurationId)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const payload = applyServerManagedFields(this.payload());

            const { error, value: dto } = CaseSessionDurationUpdateSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            dto.finished_at = this.started_at.toISOString();
            dto.updated_at = this.started_at.toISOString();
            dto.updated_by = this.user.id.value;

            const updater = new CaseSessionDurationUpdater(this.repository);
            let caseSessionDuration = await updater.execute(dto, caseSessionDurationId);

            const eventType = (dto.next_event_type || '').toUpperCase();
            if (eventType !== 'FINISHED' && eventType !== 'CANCELLED') {
                const newDto = {
                    id: ValueObjectUuid.random(),
                    case_id: caseSessionDuration.case_id.value,
                    user_id: this.user.id.value,
                    event_type: dto.next_event_type,
                    started_at: caseSessionDuration.finished_at.value,
                    created_at: caseSessionDuration.finished_at.value,
                    created_by: this.user.id.value,
                };
                try {
                    const creator = new CaseSessionDurationCreator(this.repository, this.casesRepository);
                    const newCaseSessionDuration = await creator.execute(newDto);
                    return HttpResponse.ok({ ...newCaseSessionDuration.toJson(), event: this.event });
                } catch (err) {
                    Helper.logError('Failed to create follow-up CaseSessionDuration', err);
                    return HttpResponse.internalServerError({ errors: err, event: this.event });
                }
            }
            const response = new CaseSessionDurationResponse(caseSessionDuration);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.badRequest({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const sessionDuration = await this.repository.find(new ValueObjectUuid('id', id));
            if (!sessionDuration) {
                return HttpResponse.notFound({ message: 'CaseSessionDuration not found', event: this.event });
            }

            const deletedBy = new ValueObjectUuid('deleted_by', this.user.id.value);
            await this.repository.softDelete(new ValueObjectUuid('deleted_by', id), deletedBy);

            return HttpResponse.ok({ message: 'CaseSessionDuration deleted successfully', event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    // Fetch session durations by user or by case.
    // Accepts query string params ?userId=...&caseId=... or same fields in the JSON payload.

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');
        try {
            const qs = (this.event && this.event.queryStringParameters) || {};
            const payload = this.payload() || {};

            const userId = payload.userId || qs.userId;
            const caseId = payload.caseId || qs.caseId;

            if (userId && !this.validateId(userId)) {
                return HttpResponse.badRequest({ message: 'Invalid userId', event: this.event });
            }
            if (caseId && !this.validateId(caseId)) {
                return HttpResponse.badRequest({ message: 'Invalid caseId', event: this.event });
            }

            // simple pagination support (optional)
            const page = parseInt(payload.page || qs.page || '1', 10) || 1;
            const pageSize = parseInt(payload.pageSize || qs.pageSize || '50', 10) || 50;
            const authorizedQuery = this.#authorizeSearch('case-session-duration.search', {
                userId,
                caseId,
                page,
                pageSize,
            });

            let query = this.repository.read.table(this.repository.tableName).select('*');

            if (authorizedQuery.userId) {
                query = query.where({ user_id: authorizedQuery.userId });
            }
            if (authorizedQuery.caseId) {
                query = query.where({ case_id: authorizedQuery.caseId });
            }

            const offset = (authorizedQuery.page - 1) * authorizedQuery.pageSize;

            const items = await query.orderBy('started_at', 'desc').limit(authorizedQuery.pageSize).offset(offset);

            return HttpResponse.ok({
                data: { items, page: authorizedQuery.page, pageSize: authorizedQuery.pageSize },
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
