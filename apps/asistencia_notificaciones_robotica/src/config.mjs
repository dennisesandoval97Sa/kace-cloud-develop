const REQUIRED_ENV = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
];

export function loadConfig(env = process.env) {
    const recipients = (env.ROBOTICA_ALERT_RECIPIENTS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    if (recipients.length === 0) {
        throw new Error('ROBOTICA_ALERT_RECIPIENTS is required (comma-separated list of emails)');
    }

    for (const key of REQUIRED_ENV) {
        if (!env[key]) {
            throw new Error(`Missing required env var: ${key}`);
        }
    }

    const thresholdMinutes = Number(env.ROBOTICA_THRESHOLD_MINUTES ?? '30');
    if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
        throw new Error('ROBOTICA_THRESHOLD_MINUTES must be a positive number');
    }

    const smtpPort = Number(env.SMTP_PORT);

    return {
        db: {
            host: env.DB_HOST,
            port: Number(env.DB_PORT),
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: env.DB_DATABASE,
        },
        schema: env.ROBOTICA_DB_SCHEMA ?? 'asistencia',
        thresholdMinutes,
        recipients,
        smtp: {
            host: env.SMTP_HOST,
            port: smtpPort,
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
            from: env.SMTP_FROM,
            secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : smtpPort === 465,
        },
    };
}
