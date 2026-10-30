import {
    HttpResponse,
    BaseController,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { ReportExecutionPayloadSchema } from './ReportExecutionSchema.mjs';
import {
    ReportExecutionsDeleter,
    ReportExecutionFinder,
    ReportExecutionsCreator,
    KnexReportExecutionsRepository,
    ReportExecutionSearcher,
} from '@kace/core/src/report-executions/index.js';
import { ReportExecutionRequested } from '@kace/core/src/report-executions/domain/events/ReportExecutionRequested.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.started_at = new Date();

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexReportExecutionsRepository(knexConfig, readerConfig);
        this.executionsCreator = new ReportExecutionsCreator(this.repository);
        this.searcher = new ReportExecutionSearcher(this.repository);
        this.finder = new ReportExecutionFinder(this.repository);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    /**
     * Generate a report (create execution):
     * - validate payload
     * - persist a ReportExecution record via ReportExecutionsCreator
     */
    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const payload = this.payload();

            const { error, value } = ReportExecutionPayloadSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const dto = {
                id: ValueObjectUuid.random(),
                name: value.name,
                issued_by: value.issuedBy,
                period: value.period,
                conditions: value.conditions ?? null,
                s3_file: value.s3File ?? null,
                created_by: this.user.id?.value,
                created_at: this.started_at,
            };
            const savedExecution = await this.executionsCreator.execute(dto);

            if (this.eventPublisher && savedExecution && savedExecution.id) {
                const domainEvent = new ReportExecutionRequested({
                    executionId: savedExecution.id.value,
                    reportName: savedExecution.name.value,
                    parameters: {
                        report: savedExecution.name.value,
                        period: savedExecution.period.value,
                        conditions: savedExecution.conditions?.value || [],
                    },
                    metadata: {
                        tenant_id: this.tenant?.id?.value || null,
                        user_id: this.user?.id?.value || null,
                    },
                });

                await this.eventPublisher.publish(domainEvent);
            }

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logError(error.message, error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

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

        const { value, error } = SearchSchema.validate(this.payload(), { abortEarly: false });
        if (error) {
            return HttpResponse.validationsFail({ errors: error, event: this.event });
        }

        try {
            const authorizedQuery = this.#authorizeSearch('report-executions.search', value);
            const response = await this.searcher.execute(authorizedQuery);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error.message, error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const existing = await this.finder.execute(id);
            if (!existing) {
                return HttpResponse.notFound({ message: 'ReportExecution not found', event: this.event });
            }

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user?.id?.value ?? null,
            };

            await new ReportExecutionsDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ message: 'ReportExecution deleted successfully', event: this.event });
        } catch (error) {
            Helper.logError(error.message, error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }
}
