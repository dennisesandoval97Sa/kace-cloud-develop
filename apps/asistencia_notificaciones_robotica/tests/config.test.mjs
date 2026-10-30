import { loadConfig } from '../src/config.mjs';

const baseEnv = {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'kace',
    DB_PASSWORD: 'secret',
    DB_DATABASE: 'kace_db',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'alerts@example.com',
    SMTP_PASSWORD: 'smtp-secret',
    SMTP_FROM: 'alerts@example.com',
    ROBOTICA_ALERT_RECIPIENTS: 'a@example.com, b@example.com',
};

describe('loadConfig', () => {
    it('parsea recipients quitando espacios y vacíos', () => {
        const config = loadConfig({ ...baseEnv, ROBOTICA_ALERT_RECIPIENTS: ' a@x.com ,,b@x.com ' });
        expect(config.recipients).toEqual(['a@x.com', 'b@x.com']);
    });

    it('aplica defaults: threshold 30, schema asistencia, secure por puerto 465', () => {
        const config = loadConfig(baseEnv);
        expect(config.thresholdMinutes).toBe(30);
        expect(config.schema).toBe('asistencia');
        expect(config.smtp.secure).toBe(true);
    });

    it('respeta ROBOTICA_THRESHOLD_MINUTES y ROBOTICA_DB_SCHEMA cuando vienen', () => {
        const config = loadConfig({ ...baseEnv, ROBOTICA_THRESHOLD_MINUTES: '45', ROBOTICA_DB_SCHEMA: 'otro' });
        expect(config.thresholdMinutes).toBe(45);
        expect(config.schema).toBe('otro');
    });

    it('lanza si no hay destinatarios', () => {
        expect(() => loadConfig({ ...baseEnv, ROBOTICA_ALERT_RECIPIENTS: '   ' })).toThrow(/ROBOTICA_ALERT_RECIPIENTS/);
    });

    it('lanza si falta una env var requerida de DB', () => {
        const { DB_HOST, ...rest } = baseEnv;
        expect(() => loadConfig(rest)).toThrow(/DB_HOST/);
    });

    it('lanza si el threshold no es un número positivo', () => {
        expect(() => loadConfig({ ...baseEnv, ROBOTICA_THRESHOLD_MINUTES: '0' })).toThrow(/ROBOTICA_THRESHOLD_MINUTES/);
    });
});
