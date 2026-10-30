import { CompositeRule } from '../../../actions/domain/QueryTranslator/CompositeRule.js';
import { Rule } from '../../../actions/domain/QueryTranslator/Rule.js';

const AUX_PREFIX = 'aux_cases';

/**
 * Derives the set of top-level aux_cases sub-keys (e.g. form ids) referenced by a batch of
 * actions' conditions, so CaseContextBatchLoader can project only `data->'<subkey>'` instead
 * of the whole JSONB blob.
 *
 * Why first-segment-after-aux_cases: RuleValidator.getFieldValue walks
 * `context.aux_cases.<seg1>.<seg2>...` starting from context['aux_cases']['<seg1>'].
 * Projecting data->'<seg1>' preserves every deeper path.
 */
export class AuxCaseKeyCollector {
    /**
     * @param {Array<{conditions: {value: object}}>} actions
     * @returns {Set<string>|null} set of sub-keys, an empty Set if no aux_cases rule, or
     *   `null` to signal "cannot determine safely => project full data" (bare `aux_cases`
     *   reference or unparseable conditions).
     */
    static collect(actions) {
        const keys = new Set();
        for (const action of actions) {
            let composite;
            try {
                composite = CompositeRule.fromValue(action.conditions.value);
            } catch {
                return null;
            }
            const result = AuxCaseKeyCollector.#walk(composite, keys);
            if (result === null) return null;
        }
        return keys;
    }

    static #walk(node, keys) {
        if (node instanceof CompositeRule) {
            for (const child of node.rules) {
                if (AuxCaseKeyCollector.#walk(child, keys) === null) return null;
            }
            return keys;
        }
        if (node instanceof Rule) {
            if (AuxCaseKeyCollector.#collectPath(node.field.value, keys) === null) return null;
            // entity-type rules resolve their VALUE as a context path too
            // (RuleValueCalculator.#calculateEntityValue), so an aux_cases reference there
            // must also keep its sub-key projected.
            if (node.type.value === 'entity') {
                if (AuxCaseKeyCollector.#collectPath(node.value.value, keys) === null) return null;
            }
            return keys;
        }
        return keys;
    }

    /**
     * Collects the first segment after `aux_cases.` from a context path into `keys`.
     *
     * @returns {Set<string>|null} keys, or null when the path is a bare/empty `aux_cases`
     *   reference (=> caller must degrade to full data).
     */
    static #collectPath(path, keys) {
        if (typeof path !== 'string') return keys;
        if (path === AUX_PREFIX) return null;
        if (path.startsWith(`${AUX_PREFIX}.`)) {
            const subKey = path.slice(AUX_PREFIX.length + 1).split('.')[0];
            if (!subKey) return null;
            keys.add(subKey);
        }
        return keys;
    }
}
