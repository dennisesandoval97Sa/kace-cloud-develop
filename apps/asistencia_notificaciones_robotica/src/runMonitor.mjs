import { evaluate } from './RoboticaMonitorService.mjs';

export async function runMonitor({ config, fetchLastUpdate, sendAlert, logger }) {
    const { lastUpdate, minutesSince } = await fetchLastUpdate({
        db: config.db,
        schema: config.schema,
    });

    const decision = evaluate({
        lastUpdate,
        minutesSince,
        thresholdMinutes: config.thresholdMinutes,
    });

    if (decision.alert) {
        await sendAlert({
            smtp: config.smtp,
            recipients: config.recipients,
            subject: decision.subject,
            body: decision.body,
        });
        logger.info('Alerta de robótica enviada', { lastUpdate, minutesSince, recipients: config.recipients });
    } else {
        logger.info('Robótica dentro del umbral, sin alerta', { lastUpdate, minutesSince });
    }

    return { alertSent: decision.alert, lastUpdate, minutesSince };
}
