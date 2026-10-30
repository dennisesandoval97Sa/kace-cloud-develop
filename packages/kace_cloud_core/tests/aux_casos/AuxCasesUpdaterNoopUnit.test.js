import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { AuxCases } from '../../src/aux_casos/domain/AuxCases.js';
import { AuxCasesUpdater } from '../../src/aux_casos/application/update/AuxCasesUpdater.js';
import { ValidationFailError } from '../../src/shared/index.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const baseData = {
    form1: {
        campo_a: 'valor',
        campo_b: 2,
        lista: ['x', 'y'],
        anidado: { hoja: true },
    },
};

const buildHarness = () => {
    const userId = uuidv4();
    const auxCase = AuxCases.create({
        id: uuidv4(),
        caso_id: uuidv4(),
        data: clone(baseData),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        created_by: userId,
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        updated_by: userId,
    });

    const repository = {
        // function-typed mock connection: KnexRepository accepts it as a prebuilt
        // instance and skips schema/listener wiring (no client metadata).
        connection: () => {},
        tableName: 'aux_cases',
        find: jest.fn().mockResolvedValue(auxCase),
        update: jest.fn().mockResolvedValue(undefined),
        saveHistoryWithRelationships: jest.fn().mockResolvedValue(undefined),
    };

    const caseRepository = {
        find: jest.fn().mockResolvedValue({
            fecha_resolucion: null,
            cliente_id: { value: uuidv4() },
        }),
    };

    const updater = new AuxCasesUpdater(repository, caseRepository, null);
    updater.eventLogger = { log: jest.fn().mockResolvedValue(undefined) };

    return { updater, repository, auxCase, userId };
};

describe('AuxCasesUpdater no-op guard (unit)', () => {
    it('skips persistence when the dto produces no effective change', async () => {
        const { updater, repository, auxCase, userId } = buildHarness();

        const dto = {
            data: clone(baseData),
            updated_at: new Date(),
            updated_by: userId,
        };

        const result = await updater.execute(dto, auxCase.id.value);

        expect(result).toBeUndefined();
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.saveHistoryWithRelationships).not.toHaveBeenCalled();
        expect(updater.eventLogger.log).not.toHaveBeenCalled();
        expect(auxCase.changedAttributes).toEqual({});
    });

    it('persists when the dto changes data', async () => {
        const { updater, repository, auxCase, userId } = buildHarness();

        const dto = {
            data: { form1: { campo_a: 'valor cambiado' } },
            updated_at: new Date(),
            updated_by: userId,
        };

        await updater.execute(dto, auxCase.id.value);

        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(repository.saveHistoryWithRelationships).toHaveBeenCalledTimes(1);
        expect(updater.eventLogger.log).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.form1.campo_a).toBe('valor cambiado');
    });

    it('rejects with ValidationFailError before the noop guard when dto carries deleted_at', async () => {
        // Arrange: data is identical to the stored snapshot (zero diff), but the dto
        // includes deleted_at — validation must fire and reject BEFORE the noop guard
        // could short-circuit, proving guard-after-validation ordering.
        const { updater, repository, auxCase, userId } = buildHarness();

        const dto = {
            data: clone(baseData),
            updated_at: new Date(),
            updated_by: userId,
            deleted_at: new Date().toISOString(),
        };

        // Act & Assert
        await expect(updater.execute(dto, auxCase.id.value)).rejects.toThrow(ValidationFailError);
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.saveHistoryWithRelationships).not.toHaveBeenCalled();
        expect(updater.eventLogger.log).not.toHaveBeenCalled();
    });
});
