import { describe, it, expect } from '@jest/globals';
import { SyncReport } from '../../src/domain/sync-report.js';

describe('SyncReport', () => {
    it('should report no failures when every table succeeds', () => {
        const report = new SyncReport();
        report.recordSuccess({ table: 'clientes', read: 10, inserted: 3, updated: 7, ignoredColumns: [] });

        expect(report.hasFailures).toBe(false);
        expect(report.successCount).toBe(1);
        expect(report.totalCount).toBe(1);
    });

    it('should report failures when a table errors', () => {
        const report = new SyncReport();
        report.recordSuccess({ table: 'clientes', read: 1, inserted: 1, updated: 0, ignoredColumns: [] });
        report.recordFailure({ table: 'casos', error: new Error('relation does not exist') });

        expect(report.hasFailures).toBe(true);
        expect(report.successCount).toBe(1);
        expect(report.totalCount).toBe(2);
    });

    it('should format a success line with counts', () => {
        const report = new SyncReport();
        report.recordSuccess({ table: 'clientes', read: 1240, inserted: 15, updated: 1225, ignoredColumns: [] });

        expect(report.toLines()[0]).toBe('✓ clientes — 1240 filas leídas, 15 insertadas, 1225 actualizadas');
    });

    it('should append ignored columns to the success line', () => {
        const report = new SyncReport();
        report.recordSuccess({ table: 'usuarios', read: 312, inserted: 0, updated: 312, ignoredColumns: ['foto_url'] });

        expect(report.toLines()[0]).toBe(
            '✓ usuarios — 312 filas leídas, 0 insertadas, 312 actualizadas (ignoró: foto_url)'
        );
    });

    it('should format a failure line with the error message', () => {
        const report = new SyncReport();
        report.recordFailure({ table: 'casos', error: new Error('relation "asistencia.casos" does not exist') });

        expect(report.toLines()[0]).toBe('✗ casos — ERROR: relation "asistencia.casos" does not exist');
    });

    it('should end with a summary line', () => {
        const report = new SyncReport();
        report.recordFailure({ table: 'casos', error: new Error('boom') });
        report.recordSuccess({ table: 'clientes', read: 1, inserted: 1, updated: 0, ignoredColumns: [] });

        expect(report.toLines()).toEqual([
            '✗ casos — ERROR: boom',
            '✓ clientes — 1 filas leídas, 1 insertadas, 0 actualizadas',
            'Resumen: 1/2 tablas OK',
        ]);
    });
});
