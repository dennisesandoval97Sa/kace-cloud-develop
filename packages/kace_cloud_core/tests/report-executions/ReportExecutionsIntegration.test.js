import { v4 as uuidv4 } from 'uuid';
import ReportExecution from '../../src/report-executions/domain/ReportExecutions.js';
import { ReportExecutionsCreator } from '../../src/report-executions/application/create/ReportExecutionsCreator.js';
import { KnexReportExecutionsRepository } from '../../src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js';
import { ReportExecutionFinder } from '../../src/report-executions/application/find/ReportExecutionFinder.js';
import { ReportExecutionsDeleter } from '../../src/report-executions/application/delete/ReportExecutionsDeleter.js';
import { knexConfig } from '../knexfile.js';
import ReportExecutionsMother from './domain/ReportExecutionsMother.js';

describe('ReportExecutions Integration Tests', () => {
    const repository = new KnexReportExecutionsRepository(knexConfig);

    // Use ReportExecutionsMother to build test DTOs

    it('should create a ReportExecution via Creator and persist', async () => {
        const dto = ReportExecutionsMother.dto();
        const creator = new ReportExecutionsCreator(repository);

        // ensure issued_by user exists in usuarios table (creator now validates issued_by)
        await repository
            .connection('usuarios')
            .insert({ id: dto.issued_by, nombres: 'Test User', created_at: new Date() });

        const result = await creator.execute(dto);

        const row = await repository.connection(repository.tableName).select('*').where('id', dto.id).first();
        expect(row).toBeDefined();
        expect(row.name).toBe(dto.name);
        expect(row.period).toBeDefined();
    });

    it('should find a persisted ReportExecution using Finder', async () => {
        const dto = ReportExecutionsMother.dto();
        const domain = ReportExecution.create(dto);
        await ReportExecutionsMother.ensureRelations(repository.connection, dto);
        await repository.save(domain);

        const finder = new ReportExecutionFinder(repository);
        const response = await finder.execute(dto.id);
        expect(response).not.toBeNull();
        const data = response.toJson();
        expect(data.id).toBe(dto.id);
        expect(data.report_name).toBe(dto.name);
    });

    it('should update an existing ReportExecution', async () => {
        const loaded = await ReportExecutionsMother.createReport(repository);

        loaded.markAsInProgress();
        loaded.markAsCompleted({ file_url: 's3://bucket/new.xlsx' });

        await repository.update(loaded);

        const finder = new ReportExecutionFinder(repository);
        const response = await finder.execute(loaded.id.value);
        const updatedData = response.toJson();
        expect(updatedData.status).toBe('completed');
        expect(updatedData.result).toEqual({ file_url: 's3://bucket/new.xlsx' });
        expect(updatedData.parameters.conditions).toBeDefined();
    });

    it('should soft delete a ReportExecution via Deleter and Finder throws not found', async () => {
        const dto = ReportExecutionsMother.dto();
        const domain = ReportExecution.create(dto);
        await ReportExecutionsMother.ensureRelations(repository.connection, dto);
        await repository.save(domain);

        const deletedBy = uuidv4();
        const deleter = new ReportExecutionsDeleter(repository);
        await deleter.execute(dto.id, { deleted_at: new Date().toISOString(), deleted_by: deletedBy });

        const finder = new ReportExecutionFinder(repository);
        await expect(finder.execute(dto.id)).rejects.toThrow('Report Execution not found');
    });

    it('should create a ReportExecution with period using initialDate/endDate format and conditions', async () => {
        const dto = {
            id: uuidv4(),
            name: 'reports_case_details_20260415',
            issued_by: uuidv4(),
            period: {
                field: 'fecha_resolucion',
                initialDate: '2026-04-27T07:00:00.000Z',
                endDate: '2026-05-01T04:02:59.999Z',
            },
            conditions: [
                { field: 'status', operator: 'equals', value: 'closed', type: 'AND' },
                { field: 'priority', operator: 'in', value: ['high', 'medium'], type: 'OR' },
            ],
            s3_file: 's3://s3pruebaskace/reporting/20260415_132120_reports_case_details.xlsx',
            created_at: new Date(),
            created_by: uuidv4(),
        };

        const creator = new ReportExecutionsCreator(repository);
        await repository
            .connection('usuarios')
            .insert({ id: dto.issued_by, nombres: 'Test User', created_at: new Date() });

        await creator.execute(dto);

        const row = await repository.connection(repository.tableName).select('*').where('id', dto.id).first();
        expect(row).toBeDefined();
        expect(row.name).toBe(dto.name);
        expect(row.period).toBeDefined();
        const period = typeof row.period === 'string' ? JSON.parse(row.period) : row.period;
        expect(period.field).toBe('fecha_resolucion');
        expect(period.initialDate).toBe('2026-04-27T07:00:00.000Z');
        expect(period.endDate).toBe('2026-05-01T04:02:59.999Z');

        const finder = new ReportExecutionFinder(repository);
        const response = await finder.execute(dto.id);
        expect(response).not.toBeNull();
        const data = response.toJson();
        expect(data.parameters.conditions).toHaveLength(2);
        expect(data.parameters.conditions[0].field).toBe('status');
        expect(data.parameters.conditions[0].operator).toBe('equals');
        expect(data.parameters.conditions[1].field).toBe('priority');
        expect(data.parameters.conditions[1].operator).toBe('in');
    });
});
