import { loadConfig } from './config.mjs';
import { runMonitor } from './runMonitor.mjs';
import { fetchLastUpdate } from './roboticaRepository.mjs';
import { sendAlert } from './mailer.mjs';

const logger = {
    info: (msg, meta = {}) => process.stdout.write(`${JSON.stringify({ level: 'info', msg, ...meta })}\n`),
    error: (msg, meta = {}) => process.stderr.write(`${JSON.stringify({ level: 'error', msg, ...meta })}\n`),
};

export const handler = async () => {
    const config = loadConfig();

    try {
        const result = await runMonitor({ config, fetchLastUpdate, sendAlert, logger });
        return { statusCode: 200, body: JSON.stringify(result) };
    } catch (error) {
        logger.error('RoboticaMonitor failed', { error: error.message });
        throw error;
    }
};
