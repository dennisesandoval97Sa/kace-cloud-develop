/**
 * Utility class for formatting date values into human-readable strings.
 *
 * This formatter replicates the frontend behavior using JavaScript's native `Date` object,
 * ensuring consistent timezone handling between backend exports and UI display.
 *
 * It supports multiple date and datetime patterns and safely handles invalid or null values.
 *
 * @example
 * DateFormatter.format('2026-02-20T15:00:00.000Z', 'YYYY/MM/DD HH:MM:SS');
 * // Returns: '2026/02/20 10:00:00' (depending on local timezone)
 *
 * @example
 * DateFormatter.format('2026-02-13T08:21:26-05:00', 'DD/MM/YY');
 * // Returns: '13/02/26'
 */
export class DateFormatter {
    /**
     * Formats a date value into a string based on the provided pattern.
     *
     * The function uses JavaScript's native `Date` constructor, which automatically
     * interprets timezone information (UTC or offset) and converts it to local time,
     * ensuring consistency with frontend rendering.
     *
     * @param {string|number|Date} date - The input date value (ISO string, timestamp, or Date object).
     * @param {string} [pattern='YYYY/MM/DD HH:MM:SS'] - The output format pattern.
     *
     * Supported patterns:
     * - 'YYYY/MM/DD'
     * - 'DD/MM/YY'
     * - 'MM/DD/YYYY'
     * - 'DD-MM-YYYY'
     * - 'MMM DD, YYYY'
     * - 'YYYY/MM/DD HH:MM:SS'
     * - 'DD/MM/YY HH:MM:SS'
     * - 'MM/DD/YYYY HH:MM:SS'
     * - 'DD-MM-YYYY HH:MM:SS'
     * - 'MMM DD, YYYY HH:MM:SS'
     *
     * @returns {string} Formatted date string, or empty string if the input is invalid.
     */

    static format(date, pattern = 'YYYY/MM/DD HH:MM:SS', tz) {
        if (date === null || date === undefined) return '';
        const d = new Date(date);
        if (isNaN(d)) return '';

        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(d);

        const get = (type) => parts.find((p) => p.type === type)?.value;

        const YYYY = get('year');
        const MM = get('month');
        const DD = get('day');
        const HH = get('hour');
        const mm = get('minute');
        const SS = get('second');

        const monthShort = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            month: 'short',
        }).format(d);

        switch (pattern) {
            case 'YYYY/MM/DD':
                return `${YYYY}/${MM}/${DD}`;

            case 'DD/MM/YY':
                return `${DD}/${MM}/${YYYY.slice(-2)}`;

            case 'MM/DD/YYYY':
                return `${MM}/${DD}/${YYYY}`;

            case 'DD-MM-YYYY':
                return `${DD}-${MM}-${YYYY}`;

            case 'MMM DD, YYYY':
                return `${monthShort} ${DD}, ${YYYY}`;

            case 'YYYY/MM/DD HH:MM:SS':
                return `${YYYY}/${MM}/${DD} ${HH}:${mm}:${SS}`;

            case 'DD/MM/YY HH:MM:SS':
                return `${DD}/${MM}/${YYYY.slice(-2)} ${HH}:${mm}:${SS}`;

            case 'MM/DD/YYYY HH:MM:SS':
                return `${MM}/${DD}/${YYYY} ${HH}:${mm}:${SS}`;

            case 'DD-MM-YYYY HH:MM:SS':
                return `${DD}-${MM}-${YYYY} ${HH}:${mm}:${SS}`;

            case 'MMM DD, YYYY HH:MM:SS':
                return `${monthShort} ${DD}, ${YYYY} ${HH}:${mm}:${SS}`;

            default:
                return `${YYYY}/${MM}/${DD} ${HH}:${mm}:${SS}`;
        }
    }
}
