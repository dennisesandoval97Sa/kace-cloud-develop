import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TenantContext } from '../infrastructure/context/TenantContext.js';

/**
 * Create a custom dayjs instance. This instance will use the timezone specified in the config.
 *
 * @param {Object} config
 * @param {string} [config.timezoneName=process.env.TIMEZONE || 'America/Bogota'] Timezone to use in the custom dayjs instance.
 * @param {Array} [config.plugins=[]] Array of plugins to extend the custom dayjs instance.
 * @param {boolean} [config.useTimezoneByDefault=true] If true, the custom dayjs instance will use the timezone by default.
 * @returns {Function} Custom dayjs instance.
 */
const createDayjsInstance = ({
    timezoneName = TenantContext.getTenant()?.timezone?.value ?? process.env.TIMEZONE ?? 'America/Bogota',
    plugins = [],
    useTimezoneByDefault = true,
}) => {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.tz.setDefault(timezoneName);

    plugins.forEach((plugin) => dayjs.extend(plugin));

    const customDayjs = useTimezoneByDefault
        ? (...args) => dayjs(...args).tz(timezoneName)
        : (...args) => dayjs(...args);

    Object.defineProperties(customDayjs, Object.getOwnPropertyDescriptors(dayjs));

    return customDayjs;
};

export default createDayjsInstance;
