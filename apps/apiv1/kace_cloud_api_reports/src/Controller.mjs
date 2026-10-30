import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { ReportExecution } from '@kace/core/src/report-executions/domain/ReportExecutions.js';
import { ReportExecutionRequested } from '@kace/core/src/report-executions/domain/events/ReportExecutionRequested.js';
import { KnexReportExecutionsRepository } from '@kace/core/src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js';
import { ReportExecutionResponse } from '@kace/core/src/report-executions/application/ReportExecutionResponse.js';
import { ReportPayloadSchema } from './ReportSchema.mjs';
import { S3StorageService } from '@kace/core/src/csv-export-views/index.js';
import {
    ExcelExporter,
    ReportCreator,
    ReportColumnFinder,
    ReportDistinctValuesFinder,
    KnexReportsViewRepository,
} from '@kace/core/src/reports/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.started_at = new Date();
        const { readerConfig } = this.event.tenantContext;
        this.reportViewRepository = new KnexReportsViewRepository(knexConfig, readerConfig);
        this.executionRepository = new KnexReportExecutionsRepository(this.database_connection);

        // Excel exporter and S3 storage service
        this.excelExporter = new ExcelExporter({});
        const { tenant } = this.event.tenantContext;
        this.s3StorageService = new S3StorageService({
            region: tenant.aws_s3_region.value,
            accessKeyId: tenant.aws_s3_access_key_id.value,
            secretAccessKey: tenant.aws_s3_secret_access_key.value,
            bucket: tenant.aws_s3_bucket.value,
        });

        // Application services
        this.reportCreator = new ReportCreator({
            reportViewRepository: this.reportViewRepository,
            excelExporter: this.excelExporter,
            s3StorageService: this.s3StorageService,
        });

        // Finder to retrieve columns for a report view
        this.reportColumnFinder = new ReportColumnFinder(this.reportViewRepository);

        // Finder to retrieve distinct field values for a report view
        this.reportDistinctValuesFinder = new ReportDistinctValuesFinder(this.reportViewRepository);
    }

    async destroyDbConnection() {
        await this.reportViewRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const payload = this.payload();

            const { error, value } = ReportPayloadSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const execution = new ReportExecution({
                id: ValueObjectUuid.random(),
                name: value.report,
                period: value.period,
                conditions: value.conditions,
                status: 'pending',
                created_by: this.user.id.value,
                issued_by: this.user.id.value,
                created_at: new Date(),
            });

            await this.executionRepository.save(execution);

            const domainEvent = new ReportExecutionRequested({
                executionId: execution.id.value,
                reportName: value.report,
                parameters: value,
                metadata: {
                    tenant_id: this.tenant.id.value,
                    user_id: this.user.id.value,
                },
            });

            await this.eventPublisher.publish(domainEvent);

            return HttpResponse.accepted({
                data: {
                    execution_id: execution.id.value,
                    status: 'pending',
                },
                event: this.event,
            });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionAdvanceSearch() {
        Helper.logInfo('Begin actionAdvanceSearch');

        try {
            const name = this.event?.queryStringParameters?.name;
            const field = this.event?.queryStringParameters?.field;

            if (!name || !field) {
                return HttpResponse.badRequest({
                    message: 'Missing query parameters: `name` and `field` are required',
                    event: this.event,
                });
            }

            const limit = Math.min(parseInt(this.event?.queryStringParameters?.limit ?? '50', 10), 200);
            const offset = parseInt(this.event?.queryStringParameters?.offset ?? '0', 10);
            const search = this.event?.queryStringParameters?.search ?? '';

            // Guard-only: this endpoint reads from query-string params, so we authorize for the
            // side effect (throws SearchAuthorizationError on denial) and do not reuse the return value.
            this.#authorizeSearch('reports.search', { name, field, search, limit, offset });

            const { items, total } = await this.reportDistinctValuesFinder.execute(name, field, {
                limit,
                offset,
                search,
            });

            return HttpResponse.ok({
                data: { items },
                metadata: { count: total },
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
            Helper.logInfo('End actionAdvanceSearch');
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

        try {
            // Only accept a single query parameter `name` which identifies the report/view
            const name = this.event?.queryStringParameters?.name;

            if (!name) {
                return HttpResponse.badRequest({ message: 'Missing query parameter `name`', event: this.event });
            }

            const authorizedQuery = this.#authorizeSearch('reports.search', { name });

            const response = await this.reportColumnFinder.execute(authorizedQuery.name);

            return HttpResponse.ok({ data: response.toJson(), event: this.event });
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
    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const id = this.event.pathParameters?.id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const execution = await this.executionRepository.find(id);
            if (!execution) {
                return HttpResponse.notFound({
                    message: 'Execution not found',
                    event: this.event,
                });
            }

            const response = new ReportExecutionResponse(execution);
            return HttpResponse.ok({ data: response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
}
