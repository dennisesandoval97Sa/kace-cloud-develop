import { jest } from '@jest/globals';
import { CasesProcessor } from '../../src/actions-queue-executions/domain/services/CasesProcessor.js';
import { NO_PREFILTER } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';

const fakeCase = (id) => ({
    id: { value: id },
    cliente_id: { value: 'cli' },
    clasificacion_id: { value: 'cla' },
    transicion_id: { value: 'tr' },
    toJson: () => ({ id }),
});

const fakeAction = (id) => ({
    id: { value: id },
    conditions: { value: { id: 'c', combinator: 'and', rules: [] } },
    entity: { value: 'case' },
});

describe('CasesProcessor (new flow)', () => {
    it('processes only candidates from SQL pre-filter when all actions translatable', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(new Set(['c1', 'c2']))
                .mockResolvedValueOnce(new Set(['c2', 'c3'])),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                    ['c3', { cases: { id: 'c3' } }],
                ])
            ),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2'), fakeCase('c3')]),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1'), fakeAction('a2')]);

        expect(finder.find).toHaveBeenCalledTimes(2);
        // Phase 2: load candidates (c1 union c2 union c3)
        expect(findAllActive.execute).toHaveBeenCalledTimes(1);
        const callArgs = findAllActive.execute.mock.calls[0];
        expect(callArgs[1].restrictToIds.sort()).toEqual(['c1', 'c2', 'c3']);
        expect(loader.load).toHaveBeenCalledTimes(1);
        // a1 validates c1 and c2; a2 validates c2 and c3 → 4 total
        expect(validator.validateWithContext).toHaveBeenCalledTimes(4);
        expect(processor.getSuccessOperations()).toHaveLength(4);
    });

    it('falls back to loading all active cases when at least one action has NO_PREFILTER', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(NO_PREFILTER)
                .mockResolvedValueOnce(new Set(['c2'])),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                ])
            ),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2')]),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1'), fakeAction('a2')]);

        // The fallback universe fetch (a1's NO_PREFILTER) already hydrates c1+c2, and a2's SQL
        // prefilter result ({c2}) is a subset of it, so Phase 2 must NOT re-fetch by id — reusing
        // the already-hydrated entities avoids materializing the same rows twice.
        expect(findAllActive.execute).toHaveBeenCalledTimes(1);
        // a1 (NO_PREFILTER) gets all active = c1, c2; a2 gets c2 → validations: 2+1=3
        expect(validator.validateWithContext).toHaveBeenCalledTimes(3);
    });

    it('only fetches by id the candidates NOT already covered by the fallback universe load', async () => {
        // a1 has NO_PREFILTER (triggers the fallback, hydrating c1+c2); a2's SQL prefilter
        // returns c3, which is NOT in the fallback set and must be fetched separately.
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(NO_PREFILTER)
                .mockResolvedValueOnce(new Set(['c3'])),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                    ['c3', { cases: { id: 'c3' } }],
                ])
            ),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn((_filters, options) => {
                if (!options?.restrictToIds) return Promise.resolve([fakeCase('c1'), fakeCase('c2')]);
                return Promise.resolve(options.restrictToIds.map(fakeCase));
            }),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1'), fakeAction('a2')]);

        expect(findAllActive.execute).toHaveBeenCalledTimes(2);
        const byIdCall = findAllActive.execute.mock.calls.find((call) => call[1]?.restrictToIds);
        expect(byIdCall[1].restrictToIds).toEqual(['c3']);
        // a1 validates c1,c2 (fallback); a2 validates c3 (fetched by id) → 3 total
        expect(validator.validateWithContext).toHaveBeenCalledTimes(3);
    });

    it('passes auxCaseKeys derived from the actions conditions to the context loader', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['c1'])) };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map([['c1', { cases: { id: 'c1' } }]])),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = { execute: jest.fn().mockResolvedValue([fakeCase('c1')]) };

        const action = {
            id: { value: 'a1' },
            conditions: {
                value: {
                    combinator: 'and',
                    rules: [
                        {
                            field: 'aux_cases.form1.ciudad',
                            operator: '=',
                            value: 'Bogota',
                            type: 'manual_input',
                            value_type: 'text',
                        },
                    ],
                },
            },
            entity: { value: 'case' },
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([action]);

        expect(loader.load).toHaveBeenCalledTimes(1);
        const passedOpts = loader.load.mock.calls[0][1];
        expect(passedOpts.auxCaseKeys).toEqual(new Set(['form1']));
    });

    it('routes errored ops to errorOperations ONLY (mutual exclusion)', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['c1', 'c2'])) };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                ])
            ),
        };
        const validator = {
            validateWithContext: jest.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('boom')),
        };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2')]),
        };

        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(processor.getSuccessOperations()).toHaveLength(1);
        expect(processor.getErrorOperations()).toHaveLength(1);
        expect(processor.getFailedOperations()).toHaveLength(0);
    });

    it('separates success, ruleFalse (result=false), and errored (throw) into distinct buckets', async () => {
        const finder = { find: jest.fn().mockResolvedValue(new Set(['c1', 'c2', 'c3'])) };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                    ['c3', { cases: { id: 'c3' } }],
                ])
            ),
        };
        const validator = {
            validateWithContext: jest
                .fn()
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockRejectedValueOnce(new Error('boom')),
        };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2'), fakeCase('c3')]),
        };
        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(processor.getSuccessOperations()).toHaveLength(1);
        expect(processor.getFailedOperations()).toHaveLength(1);
        expect(processor.getErrorOperations()).toHaveLength(1);
        // No overlap
        expect(processor.getFailedOperations()[0].case.id.value).toBe('c2');
        expect(processor.getErrorOperations()[0].case.id.value).toBe('c3');
    });
});

import { LegacyCasesProcessor } from '../../src/actions-queue-executions/domain/services/LegacyCasesProcessor.js';

describe("LegacyCasesProcessor (today's behavior preserved)", () => {
    it('uses caseActionValidator.validate (not validateWithContext) per pair', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2')]),
        };

        const processor = new LegacyCasesProcessor(findAllActive, validator, 50);
        await processor.loadActiveCases();
        await processor.processCasesWithActions([fakeAction('a1')]);

        expect(validator.validate).toHaveBeenCalledTimes(2);
        expect(validator.validateWithContext).not.toHaveBeenCalled();
        expect(processor.getSuccessOperations()).toHaveLength(2);
    });
});

describe('CasesProcessor.getMetrics', () => {
    it('exposes per-run metrics after processCasesWithActions', async () => {
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(new Set(['c1']))
                .mockResolvedValueOnce(NO_PREFILTER),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(new Map([['c1', { cases: { id: 'c1' } }]])),
        };
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1')]),
        };
        const processor = new CasesProcessor(findAllActive, validator, finder, loader, 50);
        await processor.processCasesWithActions([fakeAction('a1'), fakeAction('a2')]);

        const metrics = processor.getMetrics();
        expect(metrics.actions_total).toBe(2);
        expect(metrics.actions_with_sql_prefilter).toBe(1);
        expect(metrics.actions_without_prefilter).toBe(1);
        expect(metrics.candidates_distinct).toBeGreaterThanOrEqual(1);
        expect(metrics.active_cases_loaded_fallback).toBe(true);
        expect(metrics.runtime_validations).toBeGreaterThanOrEqual(2);
        expect(metrics.duration_ms.prefilter).toBeGreaterThanOrEqual(0);
        expect(metrics.duration_ms.bulk_context).toBeGreaterThanOrEqual(0);
        expect(metrics.duration_ms.runtime_validation).toBeGreaterThanOrEqual(0);
    });
});
