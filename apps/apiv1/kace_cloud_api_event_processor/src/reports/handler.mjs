import { ReportExecutionRequested } from '@kace/core/src/report-executions/domain/events/ReportExecutionRequested.js';
import { ExecuteReportOnExecutionRequested } from '@kace/core/src/report-executions/application/event-handlers/ExecuteReportOnExecutionRequested.js';
import { KnexReportExecutionsRepository } from '@kace/core/src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js';
import { ReportCreator, ExcelExporter } from '@kace/core/src/reports/index.js';
import { buildReportViewRepository } from './buildReportViewRepository.mjs';
import { S3StorageService } from '@kace/core/src/csv-export-views/index.js';
import { TenantContext } from '@kace/core/src/shared/infrastructure/context/TenantContext.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const handlerFactories = new Map([
    [
        ReportExecutionRequested.EVENT_NAME,
        async ({ userRepository }, event) => {
            const knexInstance = userRepository.connection;
            const executionRepository = new KnexReportExecutionsRepository(knexInstance);

            const tenant = TenantContext.getTenant();
            const reportViewRepository = buildReportViewRepository(tenant);

            try {
                const s3StorageService = new S3StorageService({
                    region: tenant.aws_s3_region.value,
                    accessKeyId: tenant.aws_s3_access_key_id.value,
                    secretAccessKey: tenant.aws_s3_secret_access_key.value,
                    bucket: tenant.aws_s3_bucket.value,
                });

                const excelExporter = new ExcelExporter({});

                const reportCreator = new ReportCreator({
                    reportViewRepository,
                    excelExporter,
                    s3StorageService,
                });

                const h = new ExecuteReportOnExecutionRequested(executionRepository, reportCreator);
                await h.handle(event);
            } finally {
                await reportViewRepository.destroyConnection();
            }
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'ReportsEventProcessor',
});
