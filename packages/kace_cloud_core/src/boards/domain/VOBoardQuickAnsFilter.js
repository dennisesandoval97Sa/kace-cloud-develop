import { ValueObjectJson } from '@kace/core/src/shared/index.js';
import {
    QUICK_ANS_FILTER_DEFAULT_VALUE,
    QUICK_ANS_FILTER_LEVELS,
} from '@kace/core/src/boards/domain/QuickAnsFilterDefaults.js';

const ALLOWED_KEYS = new Set(['enabled', 'ans_column_alias', 'labels', 'use_default_colors', 'colors']);
const ALLOWED_LEVEL_KEYS = new Set(QUICK_ANS_FILTER_LEVELS.map(String));

export class VOBoardQuickAnsFilter extends ValueObjectJson {
    constructor(value) {
        const normalized = VOBoardQuickAnsFilter.#normalize(value);
        super('quick_ans_filter', normalized);
    }

    static #normalize(value) {
        if (value === null || value === undefined) {
            return structuredClone(QUICK_ANS_FILTER_DEFAULT_VALUE);
        }

        let parsed;
        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            } catch {
                throw new Error('quick_ans_filter: invalid JSON');
            }
        } else {
            parsed = value;
        }

        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('quick_ans_filter: must be an object');
        }

        for (const key of Object.keys(parsed)) {
            if (!ALLOWED_KEYS.has(key)) {
                throw new Error(`quick_ans_filter: unknown key "${key}"`);
            }
        }

        if (parsed.enabled !== undefined && typeof parsed.enabled !== 'boolean') {
            throw new Error('quick_ans_filter.enabled: must be boolean');
        }
        if (parsed.use_default_colors !== undefined && typeof parsed.use_default_colors !== 'boolean') {
            throw new Error('quick_ans_filter.use_default_colors: must be boolean');
        }
        if (
            parsed.ans_column_alias !== undefined &&
            parsed.ans_column_alias !== null &&
            typeof parsed.ans_column_alias !== 'string'
        ) {
            throw new Error('quick_ans_filter.ans_column_alias: must be string');
        }

        VOBoardQuickAnsFilter.#assertLevelMap(parsed.labels, 'labels');
        VOBoardQuickAnsFilter.#assertLevelMap(parsed.colors, 'colors');

        const next = { ...parsed };
        if (next.labels) next.labels = { ...next.labels };
        if (next.colors) next.colors = { ...next.colors };

        if (next.use_default_colors === true) {
            next.colors = { 1: '', 2: '', 3: '' };
        }

        return next;
    }

    static #assertLevelMap(map, field) {
        if (map === undefined || map === null) return;
        if (typeof map !== 'object' || Array.isArray(map)) {
            throw new Error(`quick_ans_filter.${field}: must be an object`);
        }
        for (const key of Object.keys(map)) {
            if (!ALLOWED_LEVEL_KEYS.has(String(key))) {
                throw new Error(`quick_ans_filter.${field}: unknown level "${key}"`);
            }
            if (map[key] !== null && map[key] !== undefined && typeof map[key] !== 'string') {
                throw new Error(`quick_ans_filter.${field}.${key}: must be string`);
            }
        }
    }
}
