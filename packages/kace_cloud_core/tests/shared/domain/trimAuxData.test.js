import { trimAuxData } from '../../../src/shared/domain/trimAuxData.js';

describe('trimAuxData', () => {
    it('returns data unchanged when under budget (preserves object)', () => {
        const data = { a: 1, b: { c: 'small' } };
        const result = trimAuxData(data, 10_000);
        expect(result.data).toBe(data);
        expect(result.truncated).toEqual([]);
    });

    it('returns data unchanged when under budget (preserves string type)', () => {
        const data = JSON.stringify({ a: 1 });
        const result = trimAuxData(data, 10_000);
        expect(result.data).toBe(data);
        expect(result.truncated).toEqual([]);
    });

    it('truncates the largest nested array and keeps the last N items', () => {
        const big = Array.from({ length: 2000 }, (_, i) => ({ n: i, pad: 'x'.repeat(50) }));
        const data = { asistencia_movilidad: { novedades_asistencia_movilidad: big }, otro: 'chico' };

        // budget 8000: por encima del marcador (sample_last 50 ≈ 3.8 KB) y muy por debajo del array (~144 KB)
        const result = trimAuxData(data, 8000);

        const marker = result.data.asistencia_movilidad.novedades_asistencia_movilidad;
        expect(marker._truncated).toBe(true);
        expect(marker.item_count).toBe(2000);
        expect(marker.sample_last).toHaveLength(50);
        expect(marker.sample_last[49]).toEqual(big[1999]);
        expect(result.truncated[0].path).toBe('asistencia_movilidad.novedades_asistencia_movilidad');
        expect(result.data.otro).toBe('chico');
    });

    it('parses a JSON string input when it must trim', () => {
        const big = Array.from({ length: 2000 }, (_, i) => ({ n: i, pad: 'x'.repeat(50) }));
        const data = JSON.stringify({ arr: big });

        const result = trimAuxData(data, 8000);

        expect(result.data.arr._truncated).toBe(true);
        expect(result.truncated[0].path).toBe('arr');
    });

    it('truncates a large string value', () => {
        const data = { huge: 'y'.repeat(5000), keep: 'ok' };
        const result = trimAuxData(data, 1000);
        expect(result.data.huge._truncated).toBe(true);
        expect(result.data.keep).toBe('ok');
    });

    it('terminates and trims what it can when no single field dominates', () => {
        const data = { a: 'x'.repeat(600), b: 'y'.repeat(600), c: 'z'.repeat(600) };
        const result = trimAuxData(data, 1000);
        expect(result.truncated.length).toBeGreaterThan(0);
    });

    it('returns null/undefined unchanged', () => {
        expect(trimAuxData(null, 1000)).toEqual({ data: null, truncated: [] });
        expect(trimAuxData(undefined, 1000)).toEqual({ data: undefined, truncated: [] });
    });

    it('handles keys containing dots without crashing', () => {
        const data = { 'fecha.inicio': 'x'.repeat(5000), keep: 'ok' };
        const result = trimAuxData(data, 1000);
        expect(result.data['fecha.inicio']._truncated).toBe(true);
        expect(result.data.keep).toBe('ok');
        expect(result.truncated[0].path).toBe('fecha.inicio');
    });

    it('converges when an array has few but huge items (size-capped sample)', () => {
        const huge = Array.from({ length: 10 }, (_, i) => ({ n: i, blob: 'x'.repeat(20000) }));
        const data = { arr: huge };
        const budget = 50_000;

        const result = trimAuxData(data, budget);

        expect(result.data.arr._truncated).toBe(true);
        expect(Buffer.byteLength(JSON.stringify(result.data), 'utf8')).toBeLessThanOrEqual(budget);
    });
});
