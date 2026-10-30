/**
 * Unica fuente de la duracion de una sesion de caso.
 *
 * La columna `elapsed_time` es de tipo `interval` y se escribe siempre en formato `HH:MM:SS`.
 * Antes esta formula vivia solo en CaseSessionDurationUpdater, asi que una sesion creada ya
 * terminada se guardaba con la duracion a nulo.
 */
export class ElapsedTimeCalculator {
    /**
     * @param {Date|string} startedAt
     * @param {Date|string} finishedAt
     * @returns {string|null} `HH:MM:SS`, o null si falta alguna fecha o el intervalo es negativo
     */
    static between(startedAt, finishedAt) {
        if (!startedAt || !finishedAt) {
            return null;
        }

        const elapsedMs = new Date(finishedAt) - new Date(startedAt);
        if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
            return null;
        }

        return ElapsedTimeCalculator.fromMilliseconds(elapsedMs);
    }

    /**
     * @param {number} elapsedMs
     * @returns {string} `HH:MM:SS`
     */
    static fromMilliseconds(elapsedMs) {
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Normaliza lo que devuelve el driver de pg para una columna `interval`.
     *
     * pg entrega un objeto PostgresInterval (`{hours, minutes, seconds}`, solo con las unidades
     * no nulas), no una cadena: `String(intervalo)` da '[object Object]' y ValueObjectString lo
     * rechaza. Los campos `years` y `months` se ignoran deliberadamente: una sesion de caso no
     * dura meses, y convertirlos exigiria decidir cuantos dias tiene un mes.
     *
     * @param {object|string|null|undefined} value
     * @returns {string|null|undefined} `HH:MM:SS`, o el valor tal cual si ya era cadena o vacio
     */
    static fromPostgresInterval(value) {
        if (value === null || value === undefined || typeof value === 'string') {
            return value;
        }

        const hours = (value.days ?? 0) * 24 + (value.hours ?? 0);
        const pad = (unit) => String(unit ?? 0).padStart(2, '0');

        return `${pad(hours)}:${pad(value.minutes)}:${pad(value.seconds)}`;
    }
}
