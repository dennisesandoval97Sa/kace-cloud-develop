export function evaluate({ lastUpdate, minutesSince, thresholdMinutes }) {
    if (lastUpdate === null || minutesSince === null) {
        return {
            alert: true,
            subject: '[ALERTA] Robótica de asistencia sin registros',
            body:
                'La tabla aux_notificaciones_robotica no tiene registros: MAX(updated_at) es NULL. ' +
                'El proceso de robótica podría no haberse ejecutado nunca o la tabla está vacía.',
        };
    }

    if (minutesSince > thresholdMinutes) {
        const minutes = Math.round(minutesSince);
        const when = new Date(lastUpdate).toISOString();
        return {
            alert: true,
            subject: '[ALERTA] Robótica de asistencia sin actualización',
            body:
                `La última actualización de aux_notificaciones_robotica fue ${when} ` +
                `(hace ~${minutes} minutos), superando el umbral de ${thresholdMinutes} minutos.`,
        };
    }

    return { alert: false };
}
