import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

import { PoolTelemetry } from '../../../../src/shared/infrastructure/persistence/PoolTelemetry.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

/**
 * Builds a fake tarn pool that mimics the surface PoolTelemetry depends on:
 * the EventEmitter contract (`on`/`removeListener`) plus the gauge methods.
 */
const makeFakePool = ({ max = 10, used = 0, pendingAcquires = 0, pendingCreates = 0 } = {}) => {
    const emitter = new EventEmitter();
    return {
        max,
        on: (event, listener) => emitter.on(event, listener),
        removeListener: (event, listener) => emitter.removeListener(event, listener),
        emit: (event, ...args) => emitter.emit(event, ...args),
        listenerCount: (event) => emitter.listenerCount(event),
        numUsed: () => used,
        numFree: () => max - used,
        numPendingAcquires: () => pendingAcquires,
        numPendingCreates: () => pendingCreates,
    };
};

describe('PoolTelemetry', () => {
    let logSpy;

    beforeEach(() => {
        // PoolTelemetry emite el resumen por logDebug, no por logInfo.
        logSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('aggregates create/acquire events and emits a single pool.summary on teardown', () => {
        // Arrange
        const pool = makeFakePool({ max: 10, used: 10, pendingAcquires: 7 });
        const db = { client: { pool } };
        const endTelemetry = PoolTelemetry.attach(db, { job: 'UsersActionsJob', tenantId: 't-1' });

        // Act — simulate a connection storm: 3 physical opens (1 failed) and 2 acquire timeouts
        pool.emit('createRequest');
        pool.emit('createRequest');
        pool.emit('createRequest');
        pool.emit('createFail');
        pool.emit('acquireRequest');
        pool.emit('acquireFail');
        pool.emit('acquireFail');

        expect(logSpy).not.toHaveBeenCalled(); // nothing logged until teardown

        endTelemetry();

        // Assert
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith('pool.summary', {
            job: 'UsersActionsJob',
            tenantId: 't-1',
            poolMax: 10,
            createsAttempted: 3,
            createsFailed: 1,
            acquireFails: 2,
            peakUsed: 10,
            peakPendingAcquires: 7,
        });
    });

    it('detaches all listeners on teardown so the pool keeps no references', () => {
        // Arrange
        const pool = makeFakePool();
        const db = { client: { pool } };

        // Act
        const endTelemetry = PoolTelemetry.attach(db, {});
        endTelemetry();

        // Assert
        expect(pool.listenerCount('createRequest')).toBe(0);
        expect(pool.listenerCount('createFail')).toBe(0);
        expect(pool.listenerCount('acquireRequest')).toBe(0);
        expect(pool.listenerCount('acquireFail')).toBe(0);
    });

    it('is a no-op (returns a safe teardown) when the pool is missing', () => {
        // Arrange — knex instance whose pool was never created or already destroyed
        const db = { client: {} };

        // Act
        const endTelemetry = PoolTelemetry.attach(db, { job: 'GroupsActionsJob' });

        // Assert — teardown must not throw and must not log
        expect(() => endTelemetry()).not.toThrow();
        expect(logSpy).not.toHaveBeenCalled();
    });

    it('tolerates a pool already destroyed at teardown without throwing', () => {
        // Arrange
        const pool = makeFakePool();
        pool.removeListener = () => {
            throw new Error('pool destroyed');
        };
        const db = { client: { pool } };

        // Act
        const endTelemetry = PoolTelemetry.attach(db, {});

        // Assert
        expect(() => endTelemetry()).not.toThrow();
        expect(logSpy).toHaveBeenCalledTimes(1);
    });
});
