import { describe, it, expect } from '@jest/globals';
import { isCaseReclassificationEnabled } from '../../src/cases/application/reclassify/isCaseReclassificationEnabled.js';

const buildGlobalConfig = (casosConfig) => ({
    settings: {
        behaviors: {
            getConfig: (_role, _key) => casosConfig,
        },
    },
});

describe('isCaseReclassificationEnabled', () => {
    it('returns true when allow_case_reclassification is explicitly true', () => {
        expect(isCaseReclassificationEnabled(buildGlobalConfig({ allow_case_reclassification: true }))).toBe(true);
    });

    it('returns false when allow_case_reclassification is explicitly false', () => {
        expect(isCaseReclassificationEnabled(buildGlobalConfig({ allow_case_reclassification: false }))).toBe(false);
    });

    it('returns false when allow_case_reclassification is absent', () => {
        expect(isCaseReclassificationEnabled(buildGlobalConfig({}))).toBe(false);
    });

    it('returns false for a truthy non-boolean value', () => {
        expect(isCaseReclassificationEnabled(buildGlobalConfig({ allow_case_reclassification: 'true' }))).toBe(false);
    });

    it('returns false when globalConfig is missing', () => {
        expect(isCaseReclassificationEnabled(undefined)).toBe(false);
        expect(isCaseReclassificationEnabled({ settings: {} })).toBe(false);
    });
});
