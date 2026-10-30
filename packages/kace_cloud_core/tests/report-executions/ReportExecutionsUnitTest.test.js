import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import ReportExecution from '../../src/report-executions/domain/ReportExecutions.js';
import { ReportExecutionsCreator } from '../../src/report-executions/application/create/ReportExecutionsCreator.js';
import ReportExecutionsMother from './domain/ReportExecutionsMother.js';

describe('ReportExecution Domain & Creator', () => {
    it('should create a ReportExecution with valid data', () => {
        const dto = ReportExecutionsMother.dto();
        const report = ReportExecution.create(dto);

        expect(report.id.value).toBe(dto.id);
        expect(report.name.value).toBe(dto.name);
        expect(report.issued_by.value).toBe(dto.issued_by);
        expect(report.period.value).toEqual(dto.period);
        expect(report.conditions.value).toEqual(dto.conditions);
        expect(report.s3_file.value).toBe(dto.s3_file);
        expect(report.changedAttributes).toEqual({});
    });

    it('should update s3_file and conditions and mark changedAttributes', () => {
        const dto = ReportExecutionsMother.dto();
        const report = ReportExecution.create(dto);

        const newS3 = 's3://bucket/reports/monthly_v2.xlsx';
        const newConditions = [
            { field: 'status', operator: 'equals', value: 'open', type: 'AND' },
            { field: 'severity', operator: 'equals', value: 'high', type: 'AND' },
        ];

        report.s3_file = newS3;
        report.conditions = newConditions;

        expect(report.s3_file.value).toBe(newS3);
        expect(report.conditions.value).toEqual(newConditions);
        expect(report.changedAttributes.s3_file).toBe(newS3);
        expect(report.changedAttributes.conditions).toEqual(newConditions);
    });

    it('should throw an error with invalid id', () => {
        const dto = ReportExecutionsMother.dto();
        const invalid = { ...dto, id: 'invalid-id' };
        expect(() => ReportExecution.create(invalid)).toThrow();
    });

    it('creator should persist and return domain with id populated', async () => {
        const dto = ReportExecutionsMother.dto();
        const savedId = uuidv4();
        const mockRepo = {
            findAll: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue({
                id: savedId,
                created_at: new Date().toISOString(),
                created_by: dto.issued_by,
                s3_file: dto.s3_file,
            }),
        };

        const creator = new ReportExecutionsCreator(mockRepo);

        const result = await creator.execute(dto);

        expect(mockRepo.save).toHaveBeenCalled();
        expect(result.id).toBe(savedId);
        expect(result.s3_file).toBe(dto.s3_file);
        expect(result.created_at).toBeDefined();
        expect(result.created_by).toBe(dto.issued_by);
    });

    describe('ReportExecution domain entity', () => {
        describe('constructor', () => {
            it('initializes with status pending by default', () => {
                const exec = ReportExecutionsMother.createDomain();
                expect(exec.status.value).toBe('pending');
            });

            it('initializes with provided status', () => {
                const exec = ReportExecutionsMother.createDomain({ status: 'in_progress' });
                expect(exec.status.value).toBe('in_progress');
            });

            it('initializes with null result and error', () => {
                const exec = ReportExecutionsMother.createDomain();
                expect(exec.result.value).toBeFalsy();
                expect(exec.error.value).toBeFalsy();
            });

            it('initializes with null started_at and completed_at', () => {
                const exec = ReportExecutionsMother.createDomain();
                expect(exec.started_at.value).toBeFalsy();
                expect(exec.completed_at.value).toBeFalsy();
            });
        });

        describe('markAsInProgress()', () => {
            it('changes status to in_progress', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsInProgress();
                expect(exec.status.value).toBe('in_progress');
            });

            it('sets started_at to a date', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsInProgress();
                expect(exec.started_at.value).toBeTruthy();
            });

            it('returns the same instance (fluent)', () => {
                const exec = ReportExecutionsMother.createDomain();
                const result = exec.markAsInProgress();
                expect(result).toBe(exec);
            });
        });

        describe('markAsCompleted()', () => {
            it('changes status to completed', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsCompleted({ presignedUrl: 'https://example.com/file.xlsx' });
                expect(exec.status.value).toBe('completed');
            });

            it('stores the result data', () => {
                const exec = ReportExecutionsMother.createDomain();
                const resultData = { presignedUrl: 'https://example.com', recordCount: 99 };
                exec.markAsCompleted(resultData);
                expect(exec.result.value).toEqual(resultData);
            });

            it('sets completed_at to a date', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsCompleted({});
                expect(exec.completed_at.value).toBeTruthy();
            });

            it('returns the same instance (fluent)', () => {
                const exec = ReportExecutionsMother.createDomain();
                const result = exec.markAsCompleted({});
                expect(result).toBe(exec);
            });
        });

        describe('markAsFailed()', () => {
            it('changes status to failed', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsFailed({ message: 'boom' });
                expect(exec.status.value).toBe('failed');
            });

            it('stores the error data', () => {
                const exec = ReportExecutionsMother.createDomain();
                const errorData = { message: 'boom', failedAt: new Date().toISOString() };
                exec.markAsFailed(errorData);
                expect(exec.error.value).toEqual(errorData);
            });

            it('sets completed_at to a date', () => {
                const exec = ReportExecutionsMother.createDomain();
                exec.markAsFailed({ message: 'boom' });
                expect(exec.completed_at.value).toBeTruthy();
            });

            it('returns the same instance (fluent)', () => {
                const exec = ReportExecutionsMother.createDomain();
                const result = exec.markAsFailed({ message: 'boom' });
                expect(result).toBe(exec);
            });
        });

        describe('static create()', () => {
            it('creates an instance of ReportExecution', () => {
                const dto = {
                    id: uuidv4(),
                    name: 'sales_report',
                    period: {},
                    issued_by: uuidv4(),
                };
                const exec = ReportExecution.create(dto);
                expect(exec).toBeInstanceOf(ReportExecution);
            });
        });
    });
});
