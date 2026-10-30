import { buildEmailTemplateContext } from '../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';

// The `entity.responsable_id` stub and `userFinder` are required because buildEmailTemplateContext
// always resolves the "usuarios" block for non-Case entities (see emailTemplatesUtils.js:45-48);
// without them the call throws before reaching the finder under test.
const userFinder = { execute: async () => ({ toJson: () => ({}) }) };

describe('buildEmailTemplateContext — requests fresh reads (skipCache) for action-triggered emails', () => {
    it('passes { skipCache: true } to auxCasesFinder.execute', async () => {
        const calls = [];
        const auxCasesFinder = {
            execute: async (caseId, options) => {
                calls.push(options);
                return { toJson: () => ({ data: { data: {} } }) };
            },
        };
        const entity = { id: { value: 'case-1' }, responsable_id: { value: 'user-1' }, toJson: () => ({}) };

        await buildEmailTemplateContext({ entity, userFinder, auxCasesFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('passes { skipCache: true } to classificationFinder.execute', async () => {
        const calls = [];
        const classificationFinder = {
            execute: async (id, options) => {
                calls.push(options);
                return { toJson: () => ({ data: {} }) };
            },
        };
        const entity = {
            clasificacion_id: { value: 'clasif-1' },
            responsable_id: { value: 'user-1' },
            toJson: () => ({}),
        };

        await buildEmailTemplateContext({ entity, userFinder, classificationFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('passes { skipCache: true } to transitionFinder.execute', async () => {
        const calls = [];
        const transitionFinder = {
            execute: async (id, options) => {
                calls.push(options);
                return { estado_actual_id: { value: null }, siguiente_estado_id: { value: null } };
            },
        };
        const stateFinder = { execute: async () => ({ toJson: () => ({ data: {} }) }) };
        const entity = { transicion_id: { value: 'trans-1' }, responsable_id: { value: 'user-1' }, toJson: () => ({}) };

        await buildEmailTemplateContext({ entity, userFinder, transitionFinder, stateFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });
});
