import { KnexReportExecutionsRepository } from '@kace/core/src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import ReportExecutionsMother from '@kace/core/tests/report_executions/domain/ReportExecutionsMother.js';

describe('ReportExecutionsController E2E', () => {
    const repository = new KnexReportExecutionsRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/report-executions`
            : 'http://127.0.0.1:60019';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a ReportExecution', async () => {
        const payload = ReportExecutionsMother.dto();
        const apiPayload = {
            name: payload.name,
            issued_by: payload.issued_by,
            period: payload.period,
            conditions: payload.conditions,
            s3_file: payload.s3_file,
        };

        const response = await TestHelper.postRequest(baseUrl, apiPayload);
        expect([200, 201]).toContain(response.status);
    });

    it('return statusCode 400 when validation fails to create a ReportExecution', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should soft delete a ReportExecution', async () => {
        const dto = ReportExecutionsMother.dto();
        const report = await ReportExecutionsMother.createReport(repository, dto);

        const response = await TestHelper.deleteRequest(`${baseUrl}/${dto.id}`);
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('message', 'ReportExecution deleted successfully');

        // Verify the record is soft deleted
        const deleted = await repository.find(dto.id);
        expect(deleted).not.toBeNull();
        expect(deleted.deleted_at).toBeDefined();
        expect(deleted.deleted_at).not.toBeNull();
    });

    it('should return 404 when trying to delete a non-existent ReportExecution', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await TestHelper.deleteRequest(`${baseUrl}/${nonExistentId}`);
        expect(response.status).toBe(404);
        expect(response.data).toHaveProperty('message', 'ReportExecution not found');
    });

});
