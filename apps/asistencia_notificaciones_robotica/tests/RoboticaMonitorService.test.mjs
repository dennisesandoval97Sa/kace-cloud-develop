import { evaluate } from '../src/RoboticaMonitorService.mjs';

describe('evaluate', () => {
    it('alerta cuando minutesSince es null (tabla vacía / nunca actualizado)', () => {
        const result = evaluate({ lastUpdate: null, minutesSince: null, thresholdMinutes: 30 });
        expect(result.alert).toBe(true);
        expect(result.subject).toMatch(/sin registros/i);
        expect(result.body).toMatch(/NULL/i);
    });

    it('alerta cuando minutesSince supera el umbral', () => {
        const lastUpdate = '2026-06-22T10:00:00.000Z';
        const result = evaluate({ lastUpdate, minutesSince: 45, thresholdMinutes: 30 });
        expect(result.alert).toBe(true);
        expect(result.subject).toMatch(/sin actualización/i);
        expect(result.body).toContain('30');
        expect(result.body).toContain('45');
    });

    it('NO alerta cuando minutesSince es exactamente el umbral', () => {
        const result = evaluate({ lastUpdate: '2026-06-22T10:00:00.000Z', minutesSince: 30, thresholdMinutes: 30 });
        expect(result.alert).toBe(false);
    });

    it('NO alerta cuando minutesSince está por debajo del umbral', () => {
        const result = evaluate({ lastUpdate: '2026-06-22T10:00:00.000Z', minutesSince: 5, thresholdMinutes: 30 });
        expect(result.alert).toBe(false);
    });
});
