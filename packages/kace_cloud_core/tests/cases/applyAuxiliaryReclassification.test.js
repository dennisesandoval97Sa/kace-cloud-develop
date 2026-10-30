import { jest } from '@jest/globals';
import { CASE_RECLASSIFY_REASON_REQUIRED, CASE_RECLASSIFY_TRANSITION_REQUIRED } from '@kace/error-codes';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import {
    applyAuxiliaryReclassification,
    AUXILIARY_RECLASSIFICATION_COMMENT_REQUIRED,
    AUXILIARY_RECLASSIFICATION_TRANSITION_REQUIRED,
} from '../../src/cases/application/reclassify/applyAuxiliaryReclassification.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const G = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const R = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CASE_ID = '55555555-5555-4555-8555-555555555555';

const caseValue = () => ({
    clasificacion_id: C,
    current_clasificacion_id: A,
    transicion_id: T,
    alto_impacto: 1,
    updated_at: '2026-09-22T00:00:00.000Z',
    updated_by: '11111111-1111-4111-8111-111111111111',
});

describe('applyAuxiliaryReclassification', () => {
    it('returns the same caseValue and does not call the reclassifier without intent', async () => {
        const reclassifier = { execute: jest.fn() };
        const value = { clasificacion_id: A, current_clasificacion_id: A, alto_impacto: 1 };

        const result = await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: value,
            destino: A,
            origenFormulario: A,
            persistida: A,
            comment: undefined,
            reclassifier,
        });

        expect(result.applied).toBe(false);
        expect(result.caseValue.clasificacion_id).toBeUndefined();
        expect(result.caseValue.current_clasificacion_id).toBeUndefined();
        expect(result.caseValue.alto_impacto).toBe(1);
        expect(value.clasificacion_id).toBe(A);
        expect(reclassifier.execute).not.toHaveBeenCalled();
    });

    it('does not require a comment when destino is already persisted', async () => {
        const reclassifier = { execute: jest.fn() };
        const value = caseValue();

        const result = await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: value,
            destino: C,
            origenFormulario: A,
            persistida: C,
            comment: undefined,
            reclassifier,
        });

        expect(result.applied).toBe(false);
        expect(result.caseValue.clasificacion_id).toBeUndefined();
        expect(result.caseValue.current_clasificacion_id).toBeUndefined();
        expect(reclassifier.execute).not.toHaveBeenCalled();
    });

    it('still calls execute with the form snapshot when persistida moved', async () => {
        const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        const reclassifier = { execute: jest.fn().mockResolvedValue({}) };

        await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: caseValue(),
            destino: C,
            origenFormulario: A,
            persistida: B,
            comment: { descripcion: 'Cambio de tipología, no de estado.' },
            reclassifier,
        });

        expect(reclassifier.execute).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining({ clasificacion_id: C }),
            expect.objectContaining({ clasificacionSnapshot: A })
        );
    });

    it('treats omitted current_* as a reclassification when persistida differs', async () => {
        const reclassifier = { execute: jest.fn().mockResolvedValue({}) };
        const value = { clasificacion_id: C, transicion_id: T };

        await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: value,
            comment: { descripcion: 'Cambio de tipología, no de estado.' },
            persistida: A,
            reclassifier,
        });

        expect(reclassifier.execute).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining({ clasificacion_id: C, transicion_id: T }),
            expect.objectContaining({ clasificacionSnapshot: A })
        );
    });

    it('loads persistida via caseFinder when the caller does not pass it', async () => {
        const reclassifier = { execute: jest.fn().mockResolvedValue({}) };
        const caseFinder = { execute: jest.fn().mockResolvedValue({ clasificacion_id: { value: A } }) };

        await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: caseValue(),
            comment: { descripcion: 'Cambio de tipología, no de estado.' },
            reclassifier,
            caseFinder,
        });

        expect(caseFinder.execute).toHaveBeenCalledWith(CASE_ID);
        expect(reclassifier.execute).toHaveBeenCalled();
    });

    it('throws 400 before calling the reclassifier when the comment is missing', async () => {
        const reclassifier = { execute: jest.fn() };

        await expect(
            applyAuxiliaryReclassification({
                caseId: CASE_ID,
                caseValue: caseValue(),
                destino: C,
                origenFormulario: A,
                persistida: A,
                comment: undefined,
                reclassifier,
            })
        ).rejects.toMatchObject({
            message: AUXILIARY_RECLASSIFICATION_COMMENT_REQUIRED,
            statusCode: 400,
            publicErrorCode: CASE_RECLASSIFY_REASON_REQUIRED,
        });
        expect(reclassifier.execute).not.toHaveBeenCalled();
    });

    it('throws 400 when the comment is shorter than 3 after trim', async () => {
        const reclassifier = { execute: jest.fn() };

        await expect(
            applyAuxiliaryReclassification({
                caseId: CASE_ID,
                caseValue: caseValue(),
                destino: C,
                origenFormulario: A,
                persistida: A,
                comment: { descripcion: '  ab  ' },
                reclassifier,
            })
        ).rejects.toBeInstanceOf(CustomError);
        expect(reclassifier.execute).not.toHaveBeenCalled();
    });

    it('calls CaseReclassifier and strips clasificacion_id without mutating the input', async () => {
        const reclassifier = { execute: jest.fn().mockResolvedValue({}) };
        const value = caseValue();

        const result = await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: value,
            destino: C,
            origenFormulario: A,
            persistida: A,
            comment: { descripcion: 'Cambio de tipología, no de estado.' },
            reclassifier,
        });

        expect(reclassifier.execute).toHaveBeenCalledWith(
            CASE_ID,
            {
                clasificacion_id: C,
                transicion_id: T,
                updated_at: value.updated_at,
                updated_by: value.updated_by,
            },
            {
                clasificacionSnapshot: A,
                comment: { descripcion: 'Cambio de tipología, no de estado.' },
            }
        );
        expect(result.applied).toBe(true);
        expect(result.caseValue.clasificacion_id).toBeUndefined();
        expect(result.caseValue.current_clasificacion_id).toBeUndefined();
        expect(result.caseValue).not.toHaveProperty('clasificacion_id');
        expect(result.caseValue).not.toHaveProperty('current_clasificacion_id');
        expect(result.caseValue.alto_impacto).toBe(1);
        expect(value.clasificacion_id).toBe(C);
        expect(value.current_clasificacion_id).toBe(A);
    });

    it('throws 400 before calling the reclassifier when transicion_id is missing', async () => {
        const reclassifier = { execute: jest.fn() };
        const value = caseValue();
        delete value.transicion_id;

        await expect(
            applyAuxiliaryReclassification({
                caseId: CASE_ID,
                caseValue: value,
                destino: C,
                origenFormulario: A,
                persistida: A,
                comment: { descripcion: 'Cambio de tipología, no de estado.' },
                reclassifier,
            })
        ).rejects.toMatchObject({
            message: AUXILIARY_RECLASSIFICATION_TRANSITION_REQUIRED,
            statusCode: 400,
            publicErrorCode: CASE_RECLASSIFY_TRANSITION_REQUIRED,
        });
        expect(reclassifier.execute).not.toHaveBeenCalled();
    });

    it('forwards grupo_id and responsable_id when present on caseValue', async () => {
        const reclassifier = { execute: jest.fn().mockResolvedValue({}) };
        const value = { ...caseValue(), grupo_id: G, responsable_id: R };

        await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: value,
            destino: C,
            origenFormulario: A,
            persistida: A,
            comment: { descripcion: 'Reclasificación auxiliar con asignación.' },
            reclassifier,
        });

        expect(reclassifier.execute).toHaveBeenCalledWith(
            CASE_ID,
            {
                clasificacion_id: C,
                transicion_id: T,
                grupo_id: G,
                responsable_id: R,
                updated_at: value.updated_at,
                updated_by: value.updated_by,
            },
            {
                clasificacionSnapshot: A,
                comment: { descripcion: 'Reclasificación auxiliar con asignación.' },
            }
        );
    });

    it('forwards the auxiliary the same request saves, so the folio is built from it', async () => {
        const reclassifier = { execute: jest.fn() };
        const pendingAuxData = { f: { ciudad: 'MED' } };

        await applyAuxiliaryReclassification({
            caseId: CASE_ID,
            caseValue: caseValue(),
            destino: C,
            origenFormulario: A,
            persistida: A,
            comment: { descripcion: 'Cambio de tipología' },
            reclassifier,
            pendingAuxData,
            overrideAuxArrays: true,
        });

        expect(reclassifier.execute).toHaveBeenCalledWith(
            CASE_ID,
            expect.any(Object),
            expect.objectContaining({ pendingAuxData, overrideAuxArrays: true })
        );
    });
});
