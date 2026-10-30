import { describe, it, expect } from '@jest/globals';
import { isCaseDescriptionEditLocked } from '../../../../src/case-descriptions/application/policies/isCaseDescriptionEditLocked.js';

const buildGlobalConfig = (casosConfig) => ({
    settings: {
        behaviors: {
            getConfig: (_role, _key) => casosConfig,
        },
    },
});

describe('isCaseDescriptionEditLocked', () => {
    it('returns true when lock_case_description_edit is explicitly true', () => {
        expect(isCaseDescriptionEditLocked(buildGlobalConfig({ lock_case_description_edit: true }))).toBe(true);
    });

    it('returns false when lock_case_description_edit is explicitly false', () => {
        expect(isCaseDescriptionEditLocked(buildGlobalConfig({ lock_case_description_edit: false }))).toBe(false);
    });

    it('returns false when lock_case_description_edit is absent from the casos config', () => {
        expect(isCaseDescriptionEditLocked(buildGlobalConfig({}))).toBe(false);
    });

    it('returns false for a truthy non-boolean value (defense against === true)', () => {
        expect(isCaseDescriptionEditLocked(buildGlobalConfig({ lock_case_description_edit: 1 }))).toBe(false);
    });

    it('returns false when globalConfig is null', () => {
        expect(isCaseDescriptionEditLocked(null)).toBe(false);
    });

    it('returns false when globalConfig is undefined', () => {
        expect(isCaseDescriptionEditLocked(undefined)).toBe(false);
    });

    it('returns false when settings is missing', () => {
        expect(isCaseDescriptionEditLocked({})).toBe(false);
    });

    it('returns false when behaviors is missing', () => {
        expect(isCaseDescriptionEditLocked({ settings: {} })).toBe(false);
    });

    it('returns false when getConfig returns null for the casos key', () => {
        expect(
            isCaseDescriptionEditLocked({
                settings: { behaviors: { getConfig: () => null } },
            })
        ).toBe(false);
    });
});
