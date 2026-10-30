import { runMonitor } from '../src/runMonitor.mjs';

const noopLogger = { info: () => {}, error: () => {} };

const baseConfig = {
    db: { host: 'h', port: 5432, user: 'u', password: 'p', database: 'd' },
    schema: 'asistencia',
    thresholdMinutes: 30,
    recipients: ['a@x.com'],
    smtp: { host: 's', port: 465, user: 'u', password: 'p', from: 'f@x.com', secure: true },
};

describe('runMonitor', () => {
    it('envía alerta cuando la última actualización supera el umbral', async () => {
        const sent = [];
        const result = await runMonitor({
            config: baseConfig,
            fetchLastUpdate: async () => ({ lastUpdate: '2026-06-22T10:00:00.000Z', minutesSince: 45 }),
            sendAlert: async (payload) => {
                sent.push(payload);
            },
            logger: noopLogger,
        });
        expect(result.alertSent).toBe(true);
        expect(sent).toHaveLength(1);
        expect(sent[0].recipients).toEqual(['a@x.com']);
        expect(sent[0].subject).toMatch(/sin actualización/i);
    });

    it('NO envía alerta cuando está dentro del umbral', async () => {
        const sent = [];
        const result = await runMonitor({
            config: baseConfig,
            fetchLastUpdate: async () => ({ lastUpdate: '2026-06-22T10:00:00.000Z', minutesSince: 5 }),
            sendAlert: async (payload) => {
                sent.push(payload);
            },
            logger: noopLogger,
        });
        expect(result.alertSent).toBe(false);
        expect(sent).toHaveLength(0);
    });

    it('propaga el error si falla la consulta a la base de datos', async () => {
        await expect(
            runMonitor({
                config: baseConfig,
                fetchLastUpdate: async () => {
                    throw new Error('db down');
                },
                sendAlert: async () => {},
                logger: noopLogger,
            })
        ).rejects.toThrow('db down');
    });
});
