import { DateFormatter } from '../../src/boards/infrastructure/formatters/DateFormatter';

/**
 * Sin tercer argumento, `DateFormatter.format` deja `timeZone: undefined` en
 * `Intl.DateTimeFormat`, es decir: formatea en la zona del proceso. Las esperas
 * literales "10:15:24" solo valen si esa zona es UTC-5 (America/Bogota, la del
 * autor); con TZ=America/Mexico_City salian a las 09:15:24.
 *
 * Los casos con zona explicita conservan su literal, que es lo que de verdad
 * comprueban. Los que ejercitan el camino por defecto derivan la espera de los
 * getters locales de `Date` -- una via distinta de la que usa el formateador --
 * para seguir cubriendo el patron sin depender de la zona.
 */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const localParts = (value) => {
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');

    return {
        YYYY: String(d.getFullYear()),
        MMM: MONTHS_SHORT[d.getMonth()],
        MM: pad(d.getMonth() + 1),
        DD: pad(d.getDate()),
        HH: pad(d.getHours()),
        mm: pad(d.getMinutes()),
        SS: pad(d.getSeconds()),
    };
};

describe('DateFormatter', () => {
    const date = '2024-01-15T10:30:45Z';
    const UTC_DATE = '2026-03-25T15:15:24Z';

    it('should format date to default format YYYY/MM/DD HH:MM:SS', () => {
        const result = DateFormatter.format(date);

        const expected = new Date(date);
        const HH = String(expected.getHours()).padStart(2, '0');
        const MM = String(expected.getMinutes()).padStart(2, '0');
        const SS = String(expected.getSeconds()).padStart(2, '0');

        const formatted = `${expected.getFullYear()}/${String(expected.getMonth() + 1).padStart(2, '0')}/${String(expected.getDate()).padStart(2, '0')} ${HH}:${MM}:${SS}`;

        expect(result).toBe(formatted);
    });

    it('should format date with custom pattern', () => {
        const result = DateFormatter.format(date, 'DD-MM-YYYY');

        const { YYYY, MM, DD } = localParts(date);

        expect(result).toBe(`${DD}-${MM}-${YYYY}`);
    });

    it('should return empty string for invalid date', () => {
        const result = DateFormatter.format('invalid-date');

        expect(result).toBe('');
    });

    it('should handle null and undefined safely', () => {
        expect(DateFormatter.format(null)).toBe('');
        expect(DateFormatter.format(undefined)).toBe('');
    });

    it('should format date with time correctly', () => {
        const date = '2024-01-15T05:06:07Z';

        const result = DateFormatter.format(date, 'YYYY/MM/DD HH:MM:SS');

        expect(result).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should convert UTC date to America/Bogota timezone', () => {
        const result = DateFormatter.format(UTC_DATE, 'YYYY/MM/DD HH:MM:SS', 'America/Bogota');

        expect(result).toBe('2026/03/25 10:15:24');
    });

    it('should convert UTC date to Europe/Madrid timezone correctly (CET)', () => {
        const result = DateFormatter.format(UTC_DATE, 'YYYY/MM/DD HH:MM:SS', 'Europe/Madrid');

        expect(result).toBe('2026/03/25 16:15:24');
    });

    it('should format YYYY/MM/DD HH:MM:SS', () => {
        const result = DateFormatter.format(UTC_DATE, 'YYYY/MM/DD HH:MM:SS');

        const { YYYY, MM, DD, HH, mm, SS } = localParts(UTC_DATE);

        expect(result).toBe(`${YYYY}/${MM}/${DD} ${HH}:${mm}:${SS}`);
    });

    it('should format DD/MM/YY HH:MM:SS', () => {
        const result = DateFormatter.format(UTC_DATE, 'DD/MM/YY HH:MM:SS');

        const { YYYY, MM, DD, HH, mm, SS } = localParts(UTC_DATE);

        expect(result).toBe(`${DD}/${MM}/${YYYY.slice(-2)} ${HH}:${mm}:${SS}`);
    });

    it('should format MMM DD, YYYY HH:MM:SS', () => {
        const result = DateFormatter.format(UTC_DATE, 'MMM DD, YYYY HH:MM:SS');

        const { YYYY, MMM, DD, HH, mm, SS } = localParts(UTC_DATE);

        expect(result).toBe(`${MMM} ${DD}, ${YYYY} ${HH}:${mm}:${SS}`);
    });

    it('should format YYYY/MM/DD (date-only)', () => {
        const result = DateFormatter.format(UTC_DATE, 'YYYY/MM/DD', 'UTC');

        expect(result).toBe('2026/03/25');
    });

    it('should format DD/MM/YY (date-only)', () => {
        const result = DateFormatter.format(UTC_DATE, 'DD/MM/YY', 'UTC');

        expect(result).toBe('25/03/26');
    });

    it('should format MM/DD/YYYY (date-only)', () => {
        const result = DateFormatter.format(UTC_DATE, 'MM/DD/YYYY', 'UTC');

        expect(result).toBe('03/25/2026');
    });

    it('should format MMM DD, YYYY (date-only)', () => {
        const result = DateFormatter.format(UTC_DATE, 'MMM DD, YYYY', 'UTC');

        expect(result).toBe('Mar 25, 2026');
    });

    it('should format MM/DD/YYYY HH:MM:SS', () => {
        const result = DateFormatter.format(UTC_DATE, 'MM/DD/YYYY HH:MM:SS', 'UTC');

        expect(result).toBe('03/25/2026 15:15:24');
    });

    it('should format DD-MM-YYYY HH:MM:SS', () => {
        const result = DateFormatter.format(UTC_DATE, 'DD-MM-YYYY HH:MM:SS', 'UTC');

        expect(result).toBe('25-03-2026 15:15:24');
    });

    it('falls back to the default pattern for an unrecognized format string', () => {
        const result = DateFormatter.format(UTC_DATE, 'not-a-known-pattern', 'UTC');

        expect(result).toBe('2026/03/25 15:15:24');
    });

    it('should not mutate input date', () => {
        const input = new Date(UTC_DATE);
        const original = input.toISOString();

        DateFormatter.format(input);

        expect(input.toISOString()).toBe(original);
    });

    it('should handle Date instance input', () => {
        const dateObj = new Date(UTC_DATE);

        const result = DateFormatter.format(dateObj);

        const { YYYY, MM, DD, HH, mm, SS } = localParts(UTC_DATE);

        expect(result).toBe(`${YYYY}/${MM}/${DD} ${HH}:${mm}:${SS}`);
    });
});
