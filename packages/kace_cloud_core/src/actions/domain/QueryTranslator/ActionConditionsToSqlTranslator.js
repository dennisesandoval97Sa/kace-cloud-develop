import { CompositeRule } from './CompositeRule.js';
import { QueryTranslator } from './QueryTranslator.js';
import { RuleTranslatabilityAnalyzer } from './RuleTranslatabilityAnalyzer.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ActionConditionsToSqlTranslator {
    /**
     * @param {{ catalog: import('./FieldCatalog.js').FieldCatalog, evaluationNow?: import('dayjs').Dayjs }} opts
     */
    constructor({ catalog, evaluationNow = null }) {
        if (!catalog) throw new Error('ActionConditionsToSqlTranslator requires a catalog');
        this.catalog = catalog;
        this.evaluationNow = evaluationNow;
        this.analyzer = new RuleTranslatabilityAnalyzer(catalog);
    }

    /**
     * @returns the same knexQuery on success, or null if there is no translatable subset.
     */
    applyToQuery(knexQuery, action, opts = {}) {
        try {
            const composite = CompositeRule.fromValue(action.conditions.value);
            const subset = this.analyzer.extractSqlSubset(composite);
            if (subset === null) return null;
            const evaluationNow = opts.evaluationNow ?? this.evaluationNow;
            const translator = new QueryTranslator({ catalog: this.catalog, evaluationNow });
            translator.buildQuery(knexQuery, subset, {
                baseTable: opts.baseTable ?? 'cases',
                qualify: opts.qualify,
            });
            knexQuery.toSQL();
            return knexQuery;
        } catch (error) {
            Helper.logError(
                `ActionConditionsToSqlTranslator: translation failed for action ${action.id?.value}`,
                error
            );
            return null;
        }
    }
}
