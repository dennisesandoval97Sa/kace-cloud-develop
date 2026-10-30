import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { CASE_AUXILIARY_DATA_INVALID } from '@kace/error-codes';
import { AuxCases } from '../../src/aux_casos/domain/AuxCases.js';
import { AuxCasesUpdater } from '../../src/aux_casos/application/update/AuxCasesUpdater.js';
import { DeepMergeAuxiliariesData } from '../../src/shared/domain/services/DeepMergeAuxiliariesData.js';
import { ValidationFailError } from '../../src/shared/index.js';

const formAStructure = {
    formA: {
        type: 'object',
        required: true,
        data_structure: {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            placa: { type: 'string', required: false, unique: true },
        },
    },
};

const buildHarness = (data, { duplicated = false } = {}) => {
    const userId = uuidv4();
    const auxCase = AuxCases.create({
        id: uuidv4(),
        caso_id: uuidv4(),
        data: JSON.parse(JSON.stringify(data)),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        created_by: userId,
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        updated_by: userId,
    });
    const repository = {
        connection: () => {},
        tableName: 'aux_cases',
        find: jest.fn().mockResolvedValue(auxCase),
        update: jest.fn().mockResolvedValue(undefined),
        saveHistoryWithRelationships: jest.fn().mockResolvedValue(undefined),
        existsByFieldValue: jest.fn().mockResolvedValue(duplicated),
    };
    const caseRepository = {
        find: jest.fn().mockResolvedValue({ fecha_resolucion: null, cliente_id: { value: uuidv4() } }),
    };
    const updater = new AuxCasesUpdater(repository, caseRepository, null);
    updater.eventLogger = { log: jest.fn().mockResolvedValue(undefined) };
    const update = (patch, dataStructure = formAStructure, removedMinNowPaths = []) =>
        updater
            .execute(
                { data: patch, updated_at: new Date(), updated_by: userId },
                auxCase.id.value,
                dataStructure,
                false,
                removedMinNowPaths
            )
            .catch((error) => error);
    return { update };
};

const expectPublicFields = (error, fields) => {
    expect(error).toBeInstanceOf(ValidationFailError);
    expect(error.publicErrorCode).toBe(CASE_AUXILIARY_DATA_INVALID);
    expect(error.constructor.exposesPublicData).toBe(true);
    expect(error.toPublicData()).toEqual({ fields });
};

describe('AuxCasesUpdater publishes which auxiliary fields were rejected', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('names a field with an invalid value without exposing the value', async () => {
        const { update } = buildHarness({ formA: { a: 1, b: 2 } });

        const error = await update({ formA: { a: 'not-a-number' } });

        expectPublicFields(error, [{ field: 'aux_cases.formA.a', reason: 'invalid' }]);
        expect(error.details?.[0]?.path).toEqual(['formA', 'a']);
    });

    it('names a required field the update would leave empty', async () => {
        const { update } = buildHarness({ formA: { a: 1, b: 2 } });
        jest.spyOn(DeepMergeAuxiliariesData, 'execute').mockReturnValue({ formA: { a: 9 } });

        const error = await update({ formA: { a: 9 } });

        expectPublicFields(error, [{ field: 'aux_cases.formA.b', reason: 'required' }]);
    });

    it('names a date field moved to the past', async () => {
        const { update } = buildHarness({ formA: { fecha: '2999-01-01T00:00:00.000Z' } });

        const error = await update({ formA: { fecha: '2000-01-01T00:00:00.000Z' } }, {}, ['formA.fecha']);

        expectPublicFields(error, [{ field: 'aux_cases.formA.fecha', reason: 'past_date' }]);
    });

    it('names a unique field whose value another case already uses', async () => {
        const { update } = buildHarness({ formA: { a: 1, b: 2 } }, { duplicated: true });

        const error = await update({ formA: { placa: 'ABC123' } });

        expectPublicFields(error, [{ field: 'aux_cases.formA.placa', reason: 'duplicate' }]);
        expect(error.duplicateFields).toEqual([{ path: 'formA.placa', value: 'ABC123' }]);
    });
});
