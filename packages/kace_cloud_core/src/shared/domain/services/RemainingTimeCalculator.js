import createDayjsInstance from '../../factories/DayjsFactory.js';
import durationPlugin from 'dayjs/plugin/duration.js';
import minMaxPlugin from 'dayjs/plugin/minMax.js';
import { DomainError } from '../../errors/DomainError.js';

const dayjs = createDayjsInstance({
    plugins: [durationPlugin, minMaxPlugin],
});

function inferStandardWorkdayMinutes(shifts) {
    // Intenta inferir la duración estándar de jornada (la media/primera duración encontrada)
    const names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const n of names) {
        const s = shifts?.[n];
        if (s?.start && s?.end) {
            const mins = hhmmToMinutes(s.end) - hhmmToMinutes(s.start);
            if (mins > 0) return mins;
        }
    }
    return 480; // fallback
}

function hhmmToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
}

/**
 * Calcula minutos laborables entre dos instantes, respetando calendario de trabajo y festivos.
 * Luego normaliza a días/horas/minutos, donde "día" = standardWorkdayMinutes.
 *
 * @param {Object} params
 * @param {string|Date} params.currentDateTime - 'YYYY-MM-DD HH:mm' o Date
 * @param {string|Date} params.dueDateTime   - 'YYYY-MM-DD HH:mm' o Date
 * @param {Object} params.shifts             - horarios por día (monday Sunday) {start:'HH:mm', end:'HH:mm'}
 * @param {number[]} params.workDays         - días laborables como números 0..6 (0=domingo)
 * @param {string[]} params.holidays         - ['YYYY-MM-DD', ...]
 * @param {number} [params.standardWorkdayMinutes=480] - minutos que equivalen a 1 "día" de salida
 * @returns {{days:number, hours:number, minutes:number, totalMinutes:number, asText:string}}
 */
export function remainingTimeCalculator(params) {
    const {
        currentDateTime,
        dueDateTime,
        shifts,
        workDays,
        holidays = [],
        standardWorkdayMinutes = inferStandardWorkdayMinutes(shifts) ?? 480,
    } = params;

    let start = dayjs(currentDateTime);
    let end = dayjs(dueDateTime);

    if (!start.isValid()) {
        throw new DomainError(`currentDateTime "${currentDateTime}" for start are invalid`, 500);
    }

    if (!end.isValid()) {
        throw new DomainError(`dueDateTime "${dueDateTime}" for end are invalid`, 500);
    }

    if (end.isBefore(start) || end.isSame(start)) {
        return {
            days: 0,
            hours: 0,
            minutes: 0,
            totalMinutes: 0,
            asText: 'Remaining time: 0 days, 0 hours and 0 minutes',
        };
    }

    // Normaliza feriados a set 'YYYY-MM-DD'
    const normalizedHolidays = new Set(holidays.map((h) => dayjs(h).format('YYYY-MM-DD')));

    // Mapas utilitarios
    const dayNumToName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const isWorkDay = (d) => workDays.includes(d.day());
    const isHoliday = (d) => normalizedHolidays.has(d.format('YYYY-MM-DD'));

    // Recorremos día por día, sumando el solapamiento con la ventana laboral
    let cursor = start.startOf('day');
    const endDay = end.startOf('day');
    let totalMinutes = 0;

    while (cursor.isBefore(endDay) || cursor.isSame(endDay)) {
        if (isWorkDay(cursor) && !isHoliday(cursor)) {
            const name = dayNumToName[cursor.day()];
            const shift = shifts[name];
            if (shift && shift.start && shift.end) {
                const shiftStart = dayjs(`${cursor.format('YYYY-MM-DD')} ${shift.start}`);
                const shiftEnd = dayjs(`${cursor.format('YYYY-MM-DD')} ${shift.end}`);

                // Ventana efectiva del día = intersección entre [shiftStart, shiftEnd] y [start, end]
                const windowStart = dayjs.max(shiftStart, start);
                const windowEnd = dayjs.min(shiftEnd, end);

                if (windowEnd.isAfter(windowStart)) {
                    const minutes = windowEnd.diff(windowStart, 'minute');
                    totalMinutes += minutes;
                }
            }
        }
        cursor = cursor.add(1, 'day');
    }

    // Normalización a días/horas/minutos
    let asText = 'Remaining time: ';
    const days = Math.floor(totalMinutes / standardWorkdayMinutes);
    asText += days !== 1 ? `${days} days` : `${days} day`;
    const restLater = totalMinutes - days * standardWorkdayMinutes;
    const hours = Math.floor(restLater / 60);
    asText += hours !== 1 ? `, ${hours} hours` : `, ${hours} hour`;
    const minutes = restLater - hours * 60;
    asText += minutes !== 1 ? ` and ${minutes} minutes` : ` and ${minutes} minute`;

    return { days: days, hours: hours, minutes: minutes, totalMinutes: totalMinutes, asText: asText };
}
