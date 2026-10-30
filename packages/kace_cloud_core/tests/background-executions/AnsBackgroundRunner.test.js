import { AnsBackgroundRunner } from '../../src/ans/application/calculator/AnsBackgroundRunner.js';
import { jest } from '@jest/globals';
import { Types } from '../../src/ans/index.js';
import { BackgroundProcessEnum } from '../../src/shared/domain/enum/BackgroundProcessEnum.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { knexConfig } from '../knexfile.js';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { KnexBackgroundExecutionRepository } from '../../src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { AnsCalculator } from '../../src/ans/application/calculator/AnsCalculator.js';

describe('AnsBackgroundRunner', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const backgroundExecutionRepository = new KnexBackgroundExecutionRepository(caseRepository.connection);
    const backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);

    let runner;
    let executeSpyMock;

    beforeEach(async () => {
        jest.clearAllMocks();

        executeSpyMock = jest.spyOn(AnsCalculator.prototype, 'execute').mockResolvedValue({
            processedCases: 0,
            elapsedTime: 0,
        });

        // La migracion 20251112163305 ya siembra la fila de `ans_calculation`, y el
        // reset por test la restaura. Insertar otra dejaba DOS filas con la misma
        // `proccess_description`, y `findByProcess` resuelve con `.first()` sin
        // ORDER BY: cada lectura podia caer en una fila distinta y el estado que
        // escribia el runner no era el que leia el test. Aqui solo se normaliza.
        const seeded = await caseRepository
            .connection('background_executions')
            .where({ proccess_description: BackgroundProcessEnum.ANS_CALCULATION.value })
            .update({ execution_status: false });

        expect(seeded).toBe(1);

        runner = new AnsBackgroundRunner({
            caseRepository: caseRepository,
            backgroundExecutionService: backgroundExecutionService,
        });
    });

    afterEach(() => {
        executeSpyMock.mockRestore();
    });

    describe('execute', () => {
        it('should execute ANS calculation for all measurement types when not already running', async () => {
            const measures = Types.toJson();
            const measureKeys = Object.keys(measures);

            await runner.execute();

            expect(executeSpyMock).toHaveBeenCalledTimes(measureKeys.length);

            measureKeys.forEach((measure, index) => {
                const expectedMeasurementType = measure.charAt(0).toUpperCase() + measure.slice(1).toLowerCase();
                expect(executeSpyMock).toHaveBeenNthCalledWith(index + 1, { measurementType: expectedMeasurementType });
            });
        });

        it('should mark process as running before execution and not running after', async () => {
            await runner.execute();

            const execution = await backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );

            expect(execution).toBeDefined();
            expect(execution.execution_status.value).toBeFalsy();
        });

        it('should return skip result if process is already running', async () => {
            await backgroundExecutionService.updateBackgroundExecution(BackgroundProcessEnum.ANS_CALCULATION.value, {
                execution_status: true,
            });

            const result = await runner.execute();

            expect(result).toEqual({ skipped: true, reason: 'already_running' });
            expect(executeSpyMock).not.toHaveBeenCalled();
        });

        it('should mark process as not running even if AnsCalculator throws error', async () => {
            const error = new Error('AnsCalculator failed');
            executeSpyMock.mockRejectedValue(error);

            await expect(runner.execute()).rejects.toThrow('AnsCalculator failed');

            const execution = await backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );
            expect(execution.execution_status.value).toBeFalsy();
        });

        it('should execute successfully when background execution already exists', async () => {
            const execution = await backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );
            expect(execution).not.toBeNull();
            expect(execution.execution_status.value).toBeFalsy();
            await runner.execute();

            expect(executeSpyMock).toHaveBeenCalled();

            const updatedExecution = await backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );
            expect(updatedExecution).toBeDefined();
            expect(updatedExecution.execution_status.value).toBeFalsy();
        });

        it('should call AnsCalculator.execute with correct format for each measure type', async () => {
            const measures = Types.toJson();

            await runner.execute();

            Object.keys(measures).forEach((measure) => {
                const expectedFormat = measure.charAt(0).toUpperCase() + measure.slice(1).toLowerCase();

                expect(executeSpyMock).toHaveBeenCalledWith(
                    expect.objectContaining({
                        measurementType: expectedFormat,
                    })
                );
            });
        });
    });

    describe('Integration scenarios', () => {
        it('should handle concurrent execution attempts correctly', async () => {
            executeSpyMock.mockImplementation(() => {
                return new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                processedCases: 0,
                                elapsedTime: 0,
                            }),
                        100
                    )
                );
            });

            const firstExecution = runner.execute();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const secondExecution = runner.execute();

            const secondResult = await secondExecution;

            expect(secondResult).toEqual({ skipped: true, reason: 'already_running' });
            await expect(firstExecution).resolves.toBeUndefined();
        });

        it('should allow execution after previous execution completed', async () => {
            await runner.execute();

            let execution = await backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.ANS_CALCULATION.value
            );
            expect(execution.execution_status.value).toBeFalsy();

            await expect(runner.execute()).resolves.toBeUndefined();

            const measures = Types.toJson();
            expect(executeSpyMock).toHaveBeenCalledTimes(Object.keys(measures).length * 2);
        });
    });

    describe('Constructor', () => {
        it('should initialize with required dependencies', () => {
            const newRunner = new AnsBackgroundRunner({
                caseRepository: caseRepository,
                backgroundExecutionService: backgroundExecutionService,
            });

            expect(newRunner).toBeDefined();
            expect(newRunner).toBeInstanceOf(AnsBackgroundRunner);
        });
    });
});
