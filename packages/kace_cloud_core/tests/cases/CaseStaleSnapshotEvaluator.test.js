import { jest } from '@jest/globals';

const { CaseStaleSnapshotEvaluator, STALE_SNAPSHOT_MESSAGE } =
    await import('../../src/cases/application/CaseStaleSnapshotEvaluator.js');
const {
    CASE_TRANSITION_STALE,
    CASE_RESPONSIBLE_STALE,
    CASE_CLIENT_STALE,
    CASE_CLASSIFICATION_STALE,
    CASE_GROUP_STALE,
} = await import('@kace/error-codes');

function makeRepository({ transicionId, responsableId, clienteId, clasificacionId, grupoId, missing = false } = {}) {
    return {
        getStaleSnapshotFields: jest
            .fn()
            .mockResolvedValue(
                missing ? undefined : { transicionId, responsableId, clienteId, clasificacionId, grupoId }
            ),
    };
}

function makeGlobalConfig({ caseStaleCheck, transitionEnabled = false, responsableEnabled = false } = {}) {
    const config = {
        transition_stale_check: transitionEnabled,
        responsable_stale_check: responsableEnabled,
    };
    if (caseStaleCheck !== undefined) {
        config.case_stale_check = caseStaleCheck;
    }
    return {
        settings: {
            behaviors: {
                getConfig: jest.fn().mockReturnValue(config),
            },
        },
    };
}

describe('CaseStaleSnapshotEvaluator.execute', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns [] and the original fields when no snapshots are present', async () => {
        const caseValue = { transicion_id: 't1', responsable_id: 'r1' };
        const getGlobalConfig = jest.fn();
        const repository = makeRepository({ transicionId: 't2', responsableId: 'r2' });

        const {
            warnings,
            caseValue: next,
            responsableSnapshot,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig,
            caseId: 'case-1',
            caseValue,
        });

        expect(getGlobalConfig).not.toHaveBeenCalled();
        expect(repository.getStaleSnapshotFields).not.toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(next.transicion_id).toBe('t1');
        expect(next.responsable_id).toBe('r1');
        expect(responsableSnapshot).toBeUndefined();
        expect(transitionSnapshot).toBeUndefined();
        expect(caseValue).toEqual({ transicion_id: 't1', responsable_id: 'r1' });
    });

    it('strips transicion_id and returns CASE_TRANSITION_STALE when transition is stale and flag is on', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
            responsable_id: 'r1',
        };
        const getGlobalConfig = jest.fn().mockResolvedValue(makeGlobalConfig({ transitionEnabled: true }));
        const repository = makeRepository({ transicionId: 't-db', responsableId: 'r1' });

        const {
            warnings,
            caseValue: next,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig,
            caseId: 'case-1',
            caseValue,
        });

        expect(getGlobalConfig).toHaveBeenCalledTimes(1);
        expect(repository.getStaleSnapshotFields).toHaveBeenCalledWith('case-1');
        expect(warnings).toEqual([{ code: CASE_TRANSITION_STALE, message: STALE_SNAPSHOT_MESSAGE }]);
        expect(next.transicion_id).toBeUndefined();
        expect(next.current_transicion_id).toBeUndefined();
        expect(next.responsable_id).toBe('r1');
        expect(transitionSnapshot).toBeUndefined();
        expect(caseValue.transicion_id).toBe('t-form');
        expect(caseValue.current_transicion_id).toBe('t-load');
    });

    it('does not strip transicion_id when case_stale_check is off', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
        };
        const repository = makeRepository({ transicionId: 't-db', responsableId: 'r1' });

        const {
            warnings,
            caseValue: next,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: false }),
            caseId: 'case-1',
            caseValue,
        });

        expect(repository.getStaleSnapshotFields).not.toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(next.transicion_id).toBe('t-form');
        expect(next.current_transicion_id).toBeUndefined();
        expect(transitionSnapshot).toBeUndefined();
    });

    it('does not strip when case_stale_check is explicit false even if legacy transition flag is on', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
        };
        const repository = makeRepository({ transicionId: 't-db', responsableId: 'r1' });

        const {
            warnings,
            caseValue: next,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: false, transitionEnabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(repository.getStaleSnapshotFields).not.toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(next.transicion_id).toBe('t-form');
        expect(transitionSnapshot).toBeUndefined();
    });

    it('strips responsable_id after loading globalConfig when responsable is stale and flag is on', async () => {
        const caseValue = {
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };
        const getGlobalConfig = jest.fn().mockResolvedValue(makeGlobalConfig({ responsableEnabled: true }));
        const repository = makeRepository({ transicionId: 't1', responsableId: 'r-db' });

        const {
            warnings,
            caseValue: next,
            responsableSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig,
            caseId: 'case-1',
            caseValue,
        });

        expect(getGlobalConfig).toHaveBeenCalledTimes(1);
        expect(warnings).toEqual([{ code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE }]);
        expect(next.responsable_id).toBeUndefined();
        expect(next.current_responsable_id).toBeUndefined();
        expect(responsableSnapshot).toBeUndefined();
    });

    it('does not strip responsable_id when case_stale_check is off', async () => {
        const caseValue = {
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };
        const repository = makeRepository({ transicionId: 't1', responsableId: 'r-db' });

        const {
            warnings,
            caseValue: next,
            responsableSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: false }),
            caseId: 'case-1',
            caseValue,
        });

        expect(repository.getStaleSnapshotFields).not.toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(next.responsable_id).toBe('r-form');
        expect(responsableSnapshot).toBeUndefined();
    });

    it('returns the load snapshot for a conditional write when responsable is not stale', async () => {
        const caseValue = {
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };

        const {
            warnings,
            caseValue: next,
            responsableSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't1', responsableId: 'r-load' }),
            getGlobalConfig: async () => makeGlobalConfig({ responsableEnabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(warnings).toEqual([]);
        expect(next.responsable_id).toBe('r-form');
        expect(responsableSnapshot).toBe('r-load');
    });

    it('returns a null snapshot for a conditional write when the form loaded with no responsable', async () => {
        const { responsableSnapshot } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't1', responsableId: null }),
            getGlobalConfig: async () => makeGlobalConfig({ responsableEnabled: true }),
            caseId: 'case-1',
            caseValue: { responsable_id: 'r-form', current_responsable_id: null },
        });

        expect(responsableSnapshot).toBeNull();
    });

    it('returns the load snapshot for a conditional write when transition is not stale', async () => {
        const {
            warnings,
            transitionSnapshot,
            caseValue: next,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-load', responsableId: 'r1' }),
            getGlobalConfig: async () => makeGlobalConfig({ transitionEnabled: true }),
            caseId: 'case-1',
            caseValue: { transicion_id: 't-form', current_transicion_id: 't-load' },
        });

        expect(warnings).toEqual([]);
        expect(next.transicion_id).toBe('t-form');
        expect(transitionSnapshot).toBe('t-load');
    });

    it('reads both snapshot fields in a single query when both checks are on', async () => {
        const repository = makeRepository({ transicionId: 't-db', responsableId: 'r-db' });

        await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ transitionEnabled: true, responsableEnabled: true }),
            caseId: 'case-1',
            caseValue: {
                transicion_id: 't-form',
                current_transicion_id: 't-load',
                responsable_id: 'r-form',
                current_responsable_id: 'r-load',
            },
        });

        expect(repository.getStaleSnapshotFields).toHaveBeenCalledTimes(1);
    });

    it('returns transition then responsable when both snapshots are stale', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };

        const { warnings, caseValue: next } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-db', responsableId: 'r-db' }),
            getGlobalConfig: async () => makeGlobalConfig({ transitionEnabled: true, responsableEnabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(warnings).toEqual([
            { code: CASE_TRANSITION_STALE, message: STALE_SNAPSHOT_MESSAGE },
            { code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE },
        ]);
        expect(next.transicion_id).toBeUndefined();
        expect(next.responsable_id).toBeUndefined();
        expect(next.current_transicion_id).toBeUndefined();
        expect(next.current_responsable_id).toBeUndefined();
    });

    it('always omits snapshot fields even when values match DB', async () => {
        const caseValue = {
            transicion_id: 't1',
            current_transicion_id: 't1',
            responsable_id: 'r1',
            current_responsable_id: 'r1',
        };

        const {
            warnings,
            caseValue: next,
            responsableSnapshot,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't1', responsableId: 'r1' }),
            getGlobalConfig: async () => makeGlobalConfig({ transitionEnabled: true, responsableEnabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(warnings).toEqual([]);
        expect(next.transicion_id).toBe('t1');
        expect(next.responsable_id).toBe('r1');
        expect(next.current_transicion_id).toBeUndefined();
        expect(next.current_responsable_id).toBeUndefined();
        expect(responsableSnapshot).toBe('r1');
        expect(transitionSnapshot).toBe('t1');
        expect(caseValue.current_transicion_id).toBe('t1');
        expect(caseValue.current_responsable_id).toBe('r1');
    });

    it('strips cliente_id and returns CASE_CLIENT_STALE when client is stale and flag is on', async () => {
        const caseValue = {
            cliente_id: 'c-form',
            current_cliente_id: 'c-load',
            responsable_id: 'r1',
        };
        const repository = makeRepository({
            transicionId: 't1',
            responsableId: 'r1',
            clienteId: 'c-db',
        });

        const {
            warnings,
            caseValue: next,
            clienteSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(repository.getStaleSnapshotFields).toHaveBeenCalledWith('case-1');
        expect(warnings).toEqual([{ code: CASE_CLIENT_STALE, message: STALE_SNAPSHOT_MESSAGE }]);
        expect(warnings[0].code).toBe(CASE_CLIENT_STALE);
        expect(next.cliente_id).toBeUndefined();
        expect(next.current_cliente_id).toBeUndefined();
        expect(next.responsable_id).toBe('r1');
        expect(clienteSnapshot).toBeUndefined();
        expect(caseValue.cliente_id).toBe('c-form');
    });

    it('strips several stale fields at once with their codes', async () => {
        const caseValue = {
            cliente_id: 'c-form',
            current_cliente_id: 'c-load',
            clasificacion_id: 'cl-form',
            current_clasificacion_id: 'cl-load',
            grupo_id: 'g-form',
            current_grupo_id: 'g-load',
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };

        const { warnings, caseValue: next } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({
                clienteId: 'c-db',
                clasificacionId: 'cl-db',
                grupoId: 'g-db',
                responsableId: 'r-db',
            }),
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(warnings).toEqual([
            { code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE },
            { code: CASE_CLIENT_STALE, message: STALE_SNAPSHOT_MESSAGE },
            { code: CASE_CLASSIFICATION_STALE, message: STALE_SNAPSHOT_MESSAGE },
            { code: CASE_GROUP_STALE, message: STALE_SNAPSHOT_MESSAGE },
        ]);
        expect(next.responsable_id).toBeUndefined();
        expect(next.cliente_id).toBeUndefined();
        expect(next.clasificacion_id).toBeUndefined();
        expect(next.grupo_id).toBeUndefined();
    });

    it('does not strip cliente_id when case_stale_check is off', async () => {
        const caseValue = {
            cliente_id: 'c-form',
            current_cliente_id: 'c-load',
        };
        const repository = makeRepository({ clienteId: 'c-db' });

        const {
            warnings,
            caseValue: next,
            clienteSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository,
            getGlobalConfig: async () => makeGlobalConfig({ caseStaleCheck: false }),
            caseId: 'case-1',
            caseValue,
        });

        expect(repository.getStaleSnapshotFields).not.toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(next.cliente_id).toBe('c-form');
        expect(next.current_cliente_id).toBeUndefined();
        expect(clienteSnapshot).toBeUndefined();
    });

    it('does not CAS cliente when only legacy transition_stale_check is on', async () => {
        const caseValue = {
            cliente_id: 'c-form',
            current_cliente_id: 'c-load',
            transicion_id: 't-form',
            current_transicion_id: 't-load',
        };
        const {
            warnings,
            caseValue: next,
            clienteSnapshot,
            transitionSnapshot,
        } = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-load', clienteId: 'c-db' }),
            getGlobalConfig: async () => makeGlobalConfig({ transitionEnabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(warnings).toEqual([]);
        expect(next.cliente_id).toBe('c-form');
        expect(clienteSnapshot).toBeUndefined();
        expect(next.transicion_id).toBe('t-form');
        expect(transitionSnapshot).toBe('t-load');
    });
});

describe('CaseStaleSnapshotEvaluator.prepare', () => {
    it('skips execute and config when neither snapshot is present', async () => {
        const caseValue = { transicion_id: 't1' };
        const getGlobalConfig = jest.fn();

        const result = await CaseStaleSnapshotEvaluator.prepare({
            repository: makeRepository(),
            getGlobalConfig,
            caseId: 'case-1',
            caseValue,
        });

        expect(getGlobalConfig).not.toHaveBeenCalled();
        expect(result).toEqual({
            warnings: [],
            persistedCase: caseValue,
            transitionSnapshot: undefined,
            responsableSnapshot: undefined,
            clienteSnapshot: undefined,
            clasificacionSnapshot: undefined,
            grupoSnapshot: undefined,
        });
    });
});

describe('CaseStaleSnapshotEvaluator.applyWriteOutcome', () => {
    it('pushes write-time stale codes and strips the fields that did not persist', () => {
        const warnings = [];
        const persistedCase = { transicion_id: 't-form', responsable_id: 'r-form' };

        CaseStaleSnapshotEvaluator.applyWriteOutcome(warnings, persistedCase, {
            responsableStaleAtWrite: true,
            transitionStaleAtWrite: true,
        });

        expect(persistedCase.transicion_id).toBeUndefined();
        expect(persistedCase.responsable_id).toBeUndefined();
        expect(warnings).toEqual([
            { code: CASE_TRANSITION_STALE, message: STALE_SNAPSHOT_MESSAGE },
            { code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE },
        ]);
    });

    it('does not duplicate a warning already reported at SELECT time', () => {
        const warnings = [{ code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE }];
        const persistedCase = { responsable_id: 'r-form' };

        CaseStaleSnapshotEvaluator.applyWriteOutcome(warnings, persistedCase, {
            responsableStaleAtWrite: true,
        });

        expect(warnings).toHaveLength(1);
    });
});

describe('CaseStaleSnapshotEvaluator.httpData', () => {
    it('returns undefined when there are no warnings', () => {
        expect(CaseStaleSnapshotEvaluator.httpData([])).toBeUndefined();
    });

    it('wraps warnings for the HTTP data payload', () => {
        const warnings = [{ code: CASE_TRANSITION_STALE, message: STALE_SNAPSHOT_MESSAGE }];
        expect(CaseStaleSnapshotEvaluator.httpData(warnings)).toEqual({ warnings });
    });
});
