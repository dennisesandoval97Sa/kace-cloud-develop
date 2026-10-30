import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, formatISO, parse, parseISO } from 'date-fns';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DATE_FIELDS = ['created_at', 'updated_at', 'fecha_resolucion'];

/**
 * Gets the configured timezone
 * @returns {string} Current timezone
 */

export const convertTimestamps = (data) => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => convertTimestamps(item));
  }

  return Object.keys(data).reduce((acc, key) => {
    if (DATE_FIELDS.includes(key) && data[key]) {
      try {
        acc[key] = formatInTimeZone(
          parseISO(data[key]),
          TIMEZONE,
          'yyyy-MM-dd HH:mm:ssXXX'
        );
      } catch {
        acc[key] = data[key];
      }
    } else if (typeof data[key] === 'object') {
      acc[key] = convertTimestamps(data[key]);
    } else {
      acc[key] = data[key];
    }
    return acc;
  }, {});
};
