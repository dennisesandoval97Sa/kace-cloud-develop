import createDayjsInstance from '../../shared/factories/DayjsFactory.js';

export { RESET_POLICIES } from './segments/segmentCatalog.js';

/**
 * Resolves which counter row a reservation belongs to.
 *
 * `prefix` is the most useful of the lot: when the folio already carries a year or a
 * classification code in front of the consecutive, using the rendered prefix as the scope
 * gives an independent counter per prefix without configuring anything else.
 */
export class ScopeKeyResolver {
    /**
     * @param {string} resetPolicy
     * @param {string} prefix - the folio rendered up to the sequence segment
     * @returns {string}
     */
    static resolve(resetPolicy, prefix) {
        // Same tenant-timezone instance the date segments use, so the folio and the
        // counter scope can never disagree about which day/year it is.
        const dayjs = createDayjsInstance({});

        switch (resetPolicy) {
            case 'yearly':
                return dayjs().format('YYYY');
            case 'monthly':
                return dayjs().format('YYYY-MM');
            case 'daily':
                return dayjs().format('YYYY-MM-DD');
            case 'prefix':
                return prefix;
            case 'never':
            default:
                return '';
        }
    }
}
