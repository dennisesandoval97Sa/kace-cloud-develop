import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/shared/EventLogger.js', () => ({
    EventLogger: class EventLogger {
        constructor() {}
        async log() {}
    },
}));

const { Case, CaseUpdater } = await import('../../src/cases/index.js');
const CasesMother = (await import('./domain/CasesMother.js')).default;

const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000003';
const NEXT_RESPONSABLE = 'bbbbbbbb-0000-4000-8000-000000000004';
const T_SNAPSHOT = 'cccccccc-0000-4000-8000-000000000005';
const NEXT_TRANSITION = 'dddddddd-0000-4000-8000-000000000006';
const C_SNAPSHOT = 'eeeeeeee-0000-4000-8000-000000000007';
const NEXT_CLIENT = 'ffffffff-0000-4000-8000-000000000008';

const EMPTY_WRITE_OUTCOME = {
    transitionStaleAtWrite: false,
    responsableStaleAtWrite: false,
    clienteStaleAtWrite: false,
    clasificacionStaleAtWrite: false,
    grupoStaleAtWrite: false,
};

function makeRepository(kase, { casResults = {} } = {}) {
    return {
        find: jest.fn().mockResolvedValue(kase),
        update: jest.fn().mockResolvedValue(undefined),
        saveHistory: jest.fn().mockResolvedValue(undefined),
        updateColumnIfSnapshotMatches: jest.fn().mockImplementation(async (column) => {
            if (Object.prototype.hasOwnProperty.call(casResults, column)) {
                return casResults[column];
            }
            return true;
        }),
        findByExternalCode: jest.fn(),
        findByIdForAns: jest.fn().mockResolvedValue([]),
        connection: {
            transaction: jest.fn(async (callback) => callback(undefined)),
        },
    };
}

function makeCase(overrides = {}) {
    return new Case(
        CasesMother.dto({
            responsable_id: SNAPSHOT,
            transicion_id: T_SNAPSHOT,
            cliente_id: C_SNAPSHOT,
            fecha_resolucion: new Date().toISOString(),
            ...overrides,
        })
    );
}

function makeUpdater(repository) {
    return new CaseUpdater(repository, undefined, undefined, null, { id: { value: 'tenant-1' } });
}

describe('CaseUpdater.execute responsable CAS write', () => {
    it('writes responsable_id through the snapshot-conditional update, not the bulk UPDATE', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let bulkChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (bulkChanged === undefined) {
                bulkChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(
            kase.id.value,
            { responsable_id: NEXT_RESPONSABLE, motivo_baja: 'kept' },
            false,
            { allowUpdateClosedCase: true, responsableSnapshot: SNAPSHOT }
        );

        expect(repository.updateColumnIfSnapshotMatches).toHaveBeenCalledWith(
            'responsable_id',
            kase.id.value,
            SNAPSHOT,
            NEXT_RESPONSABLE,
            undefined
        );
        expect(bulkChanged.responsable_id).toBeUndefined();
        expect(bulkChanged.motivo_baja).toBe('kept');
        expect(kase.responsable_id.value).toBe(NEXT_RESPONSABLE);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });

    it('keeps the DB responsable and reports stale when the conditional update matches no row', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase, { casResults: { responsable_id: false } });
        const updater = makeUpdater(repository);

        const result = await updater.execute(
            kase.id.value,
            { responsable_id: NEXT_RESPONSABLE, motivo_baja: 'kept' },
            false,
            { allowUpdateClosedCase: true, responsableSnapshot: SNAPSHOT }
        );

        expect(kase.responsable_id.value).toBe(SNAPSHOT);
        expect(result).toEqual({ ...EMPTY_WRITE_OUTCOME, responsableStaleAtWrite: true });
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('writes responsable_id in the bulk UPDATE when no snapshot is provided', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let bulkChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (bulkChanged === undefined) {
                bulkChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(kase.id.value, { responsable_id: NEXT_RESPONSABLE }, false, {
            allowUpdateClosedCase: true,
        });

        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
        expect(bulkChanged.responsable_id).toBe(NEXT_RESPONSABLE);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });
});

describe('CaseUpdater.execute transition CAS write', () => {
    it('writes transicion_id through the snapshot-conditional update, not the bulk UPDATE', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let bulkChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (bulkChanged === undefined) {
                bulkChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(
            kase.id.value,
            {
                transicion_id: NEXT_TRANSITION,
                motivo_baja: 'kept',
                updated_at: new Date().toISOString(),
            },
            false,
            { allowUpdateClosedCase: true, transitionSnapshot: T_SNAPSHOT }
        );

        expect(repository.updateColumnIfSnapshotMatches).toHaveBeenCalledWith(
            'transicion_id',
            kase.id.value,
            T_SNAPSHOT,
            NEXT_TRANSITION,
            undefined
        );
        expect(bulkChanged.transicion_id).toBeUndefined();
        expect(bulkChanged.motivo_baja).toBe('kept');
        expect(kase.transicion_id.value).toBe(NEXT_TRANSITION);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });

    it('keeps the DB transition and reports stale when the conditional update matches no row', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase, { casResults: { transicion_id: false } });
        const updater = makeUpdater(repository);

        const result = await updater.execute(
            kase.id.value,
            { transicion_id: NEXT_TRANSITION, motivo_baja: 'kept' },
            false,
            { allowUpdateClosedCase: true, transitionSnapshot: T_SNAPSHOT }
        );

        expect(kase.transicion_id.value).toBe(T_SNAPSHOT);
        expect(result).toEqual({ ...EMPTY_WRITE_OUTCOME, transitionStaleAtWrite: true });
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('writes transicion_id in the bulk UPDATE when no snapshot is provided', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let bulkChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (bulkChanged === undefined) {
                bulkChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(
            kase.id.value,
            { transicion_id: NEXT_TRANSITION, updated_at: new Date().toISOString() },
            false,
            {
                allowUpdateClosedCase: true,
            }
        );

        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
        expect(bulkChanged.transicion_id).toBe(NEXT_TRANSITION);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });

    it('does not record a transition or bump state_change_at when CAS writes the same transicion_id', async () => {
        const kase = makeCase();
        const originalStateChangeAt = kase.state_change_at.value;
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let historyChanged;

        repository.saveHistory.mockImplementation(async (aggregate) => {
            historyChanged = { ...aggregate.changedAttributes };
        });

        const result = await updater.execute(
            kase.id.value,
            {
                transicion_id: T_SNAPSHOT,
                motivo_baja: 'kept',
                updated_at: new Date().toISOString(),
            },
            false,
            { allowUpdateClosedCase: true, transitionSnapshot: T_SNAPSHOT }
        );

        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
        expect(historyChanged.transicion_id).toBeUndefined();
        expect(historyChanged.state_change_at).toBeUndefined();
        expect(kase.state_change_at.value).toBe(originalStateChangeAt);
        expect(kase.transicion_id.value).toBe(T_SNAPSHOT);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });
});

describe('CaseUpdater.execute responsable CAS no-op', () => {
    it('does not record a responsable change when CAS writes the same responsable_id', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let historyChanged;

        repository.saveHistory.mockImplementation(async (aggregate) => {
            historyChanged = { ...aggregate.changedAttributes };
        });

        const result = await updater.execute(kase.id.value, { responsable_id: SNAPSHOT, motivo_baja: 'kept' }, false, {
            allowUpdateClosedCase: true,
            responsableSnapshot: SNAPSHOT,
        });

        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
        expect(historyChanged.responsable_id).toBeUndefined();
        expect(historyChanged.assignment_change_type).toBeUndefined();
        expect(kase.responsable_id.value).toBe(SNAPSHOT);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });
});

describe('CaseUpdater.execute cliente CAS write', () => {
    it('writes cliente_id through updateColumnIfSnapshotMatches, not the bulk UPDATE', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let bulkChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (bulkChanged === undefined) {
                bulkChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(kase.id.value, { cliente_id: NEXT_CLIENT, motivo_baja: 'kept' }, false, {
            allowUpdateClosedCase: true,
            clienteSnapshot: C_SNAPSHOT,
        });

        expect(repository.updateColumnIfSnapshotMatches).toHaveBeenCalledWith(
            'cliente_id',
            kase.id.value,
            C_SNAPSHOT,
            NEXT_CLIENT,
            undefined
        );
        expect(bulkChanged.cliente_id).toBeUndefined();
        expect(bulkChanged.motivo_baja).toBe('kept');
        expect(kase.cliente_id.value).toBe(NEXT_CLIENT);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });

    it('keeps the DB cliente and reports stale when the conditional update matches no row', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase, { casResults: { cliente_id: false } });
        const updater = makeUpdater(repository);

        const result = await updater.execute(kase.id.value, { cliente_id: NEXT_CLIENT, motivo_baja: 'kept' }, false, {
            allowUpdateClosedCase: true,
            clienteSnapshot: C_SNAPSHOT,
        });

        expect(kase.cliente_id.value).toBe(C_SNAPSHOT);
        expect(result).toEqual({ ...EMPTY_WRITE_OUTCOME, clienteStaleAtWrite: true });
        expect(repository.saveHistory).toHaveBeenCalled();
    });

    it('mixed responsable+cliente CAS: side-effect persist excludes cliente_id', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let sideEffectChanged;

        repository.update.mockImplementation(async (aggregate) => {
            if (repository.updateColumnIfSnapshotMatches.mock.calls.length > 0) {
                sideEffectChanged = { ...aggregate.changedAttributes };
            }
        });

        const result = await updater.execute(
            kase.id.value,
            { responsable_id: NEXT_RESPONSABLE, cliente_id: NEXT_CLIENT, motivo_baja: 'kept' },
            false,
            {
                allowUpdateClosedCase: true,
                responsableSnapshot: SNAPSHOT,
                clienteSnapshot: C_SNAPSHOT,
            }
        );

        expect(repository.updateColumnIfSnapshotMatches).toHaveBeenCalledWith(
            'cliente_id',
            kase.id.value,
            C_SNAPSHOT,
            NEXT_CLIENT,
            undefined
        );
        expect(repository.updateColumnIfSnapshotMatches).toHaveBeenCalledWith(
            'responsable_id',
            kase.id.value,
            SNAPSHOT,
            NEXT_RESPONSABLE,
            undefined
        );
        expect(sideEffectChanged).toBeDefined();
        expect(sideEffectChanged.cliente_id).toBeUndefined();
        expect(sideEffectChanged.responsable_id).toBeUndefined();
        expect(kase.cliente_id.value).toBe(NEXT_CLIENT);
        expect(kase.responsable_id.value).toBe(NEXT_RESPONSABLE);
        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });
});

describe('CaseUpdater.execute does not CAS identical values', () => {
    it('does not CAS or touch state_change_at / assignment_change_type when ids are resent unchanged', async () => {
        const kase = makeCase({ assignment_change_type: 'automatic' });
        const originalStateChangeAt = kase.state_change_at.value;
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        let historyChanged;

        repository.saveHistory.mockImplementation(async (aggregate) => {
            historyChanged = { ...aggregate.changedAttributes };
        });

        await updater.execute(
            kase.id.value,
            {
                transicion_id: T_SNAPSHOT,
                responsable_id: SNAPSHOT,
                motivo_baja: 'kept',
            },
            false,
            {
                allowUpdateClosedCase: true,
                transitionSnapshot: T_SNAPSHOT,
                responsableSnapshot: SNAPSHOT,
            }
        );

        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
        expect(historyChanged.transicion_id).toBeUndefined();
        expect(historyChanged.responsable_id).toBeUndefined();
        expect(historyChanged.assignment_change_type).toBeUndefined();
        expect(historyChanged.state_change_at).toBeUndefined();
        expect(kase.assignment_change_type.value).toBe('automatic');
        expect(kase.state_change_at.value).toBe(originalStateChangeAt);
    });

    it('second persist after a real CAS write only includes CAS side fields', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);
        const updatePayloads = [];

        repository.update.mockImplementation(async (aggregate) => {
            updatePayloads.push({ ...aggregate.changedAttributes });
        });

        await updater.execute(
            kase.id.value,
            {
                transicion_id: NEXT_TRANSITION,
                motivo_baja: 'kept',
                updated_at: new Date().toISOString(),
            },
            false,
            { allowUpdateClosedCase: true, transitionSnapshot: T_SNAPSHOT }
        );

        expect(updatePayloads).toHaveLength(2);
        expect(updatePayloads[0].motivo_baja).toBe('kept');
        expect(updatePayloads[0].transicion_id).toBeUndefined();
        expect(updatePayloads[1].motivo_baja).toBeUndefined();
        expect(updatePayloads[1].transicion_id).toBeUndefined();
        expect(updatePayloads[1].state_change_at).toBeDefined();
    });
});

/**
 * `requireSnapshotMatch` promete fail-closed: el guardado entero se deshace si ese CAS no
 * coincide. La comprobación vive dentro del bucle sobre los CAS realmente encolados, así que un
 * campo que no llega a encolarse —porque no está en el catálogo `STALE_FIELDS`— convertía la
 * promesa en un no-op silencioso. Se valida de forma eager, contra el catálogo, antes de escribir
 * nada.
 */
describe('CaseUpdater.execute requireSnapshotMatch validation', () => {
    it('rejects a field that is not registered in the STALE_FIELDS catalogue', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);

        await expect(
            updater.execute(kase.id.value, { responsable_id: NEXT_RESPONSABLE }, false, {
                allowUpdateClosedCase: true,
                responsableSnapshot: SNAPSHOT,
                requireSnapshotMatch: ['responsible_id'],
            })
        ).rejects.toThrow(/responsible_id/);

        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.updateColumnIfSnapshotMatches).not.toHaveBeenCalled();
    });

    it('rejects before touching the case, not after a partial write', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);

        await expect(
            updater.execute(kase.id.value, { responsable_id: NEXT_RESPONSABLE }, false, {
                allowUpdateClosedCase: true,
                responsableSnapshot: SNAPSHOT,
                requireSnapshotMatch: ['responsable_id', 'campo_inventado'],
            })
        ).rejects.toThrow(/campo_inventado/);

        expect(repository.connection.transaction).not.toHaveBeenCalled();
    });

    it('accepts every field of the catalogue', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);

        const result = await updater.execute(kase.id.value, { responsable_id: NEXT_RESPONSABLE }, false, {
            allowUpdateClosedCase: true,
            responsableSnapshot: SNAPSHOT,
            requireSnapshotMatch: ['responsable_id', 'transicion_id', 'cliente_id', 'clasificacion_id', 'grupo_id'],
        });

        expect(result).toEqual(EMPTY_WRITE_OUTCOME);
    });

    /**
     * Declarar el campo obligatorio sin mandar su snapshot dejaba el CAS sin encolar y la
     * obligación sin efecto: el caso se guardaba igual, pisando el valor que otro request pudo
     * haber cambiado. Es el mismo fail-open, por la otra puerta.
     */
    it('rejects a required field whose snapshot was not provided', async () => {
        const kase = makeCase();
        const repository = makeRepository(kase);
        const updater = makeUpdater(repository);

        await expect(
            updater.execute(kase.id.value, { clasificacion_id: 'ffffffff-0000-4000-8000-00000000000a' }, false, {
                allowUpdateClosedCase: true,
                requireSnapshotMatch: ['clasificacion_id'],
            })
        ).rejects.toThrow(/clasificacion_id/);

        expect(repository.update).not.toHaveBeenCalled();
    });
});
