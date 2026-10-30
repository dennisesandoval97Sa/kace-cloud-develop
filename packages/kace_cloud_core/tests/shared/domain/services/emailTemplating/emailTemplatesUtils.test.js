import { describe, it, expect } from '@jest/globals';
import {
    replaceTemplateVariables,
    buildEmailTemplateContext,
} from '../../../../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';

const noopFinder = { execute: async () => null };

const makeState = (data) => ({ toJson: () => ({ data }) });

const makeStateFinder = (byId) => ({
    execute: async (id) => makeState(byId[id] ?? {}),
});

const makeTransitionFinder = (byId) => ({
    execute: async (id) => {
        const found = byId[id];
        if (!found) return null;
        // Production entities expose estado_actual_id / siguiente_estado_id as
        // ValueObjectUuid instances. The mock must mirror that shape so the
        // production code can call .value to extract the UUID string.
        return {
            estado_actual_id: found.estado_actual_id === null ? { value: null } : { value: found.estado_actual_id },
            siguiente_estado_id: { value: found.siguiente_estado_id },
        };
    },
});

const makeCaseStub = (overrides = {}) => ({
    id: { value: 'case-1' },
    cliente_id: { value: 'client-1' },
    responsable_id: { value: 'user-1' },
    clasificacion_id: { value: null },
    transicion_id: { value: 'trans-1' },
    toJson: () => ({ id: 'case-1', descripcion: 'Test case' }),
    ...overrides,
});

describe('replaceTemplateVariables', () => {
    it('returns "" for an unresolved body/subject placeholder', () => {
        const context = { cases: { id: 'c-1' } };
        const result = replaceTemplateVariables('Hello {{caso.campo_inexistente}} world', context);
        expect(result).toBe('Hello  world');
    });

    it('returns the literal {{key}} for an unresolved email placeholder', () => {
        const context = { usuarios: { id: 'u-1' } };
        const result = replaceTemplateVariables('{{responsable.email}}', context, true);
        expect(result).toBe('{{responsable.email}}');
    });
});

describe('buildEmailTemplateContext', () => {
    it('populates estados, estados_actual, estados_siguiente from the case transition', async () => {
        const transitionFinder = makeTransitionFinder({
            'trans-1': { estado_actual_id: 'a-1', siguiente_estado_id: 's-1' },
        });
        const stateFinder = makeStateFinder({
            'a-1': { nombre: 'En revisión', color: '#aaa' },
            's-1': { nombre: 'Resuelto', color: '#0f0' },
        });

        const context = await buildEmailTemplateContext({
            entity: makeCaseStub(),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
            stateFinder,
            transitionFinder,
        });

        expect(context.estados_actual).toEqual({ nombre: 'En revisión', color: '#aaa' });
        expect(context.estados_siguiente).toEqual({ nombre: 'Resuelto', color: '#0f0' });
        expect(context.estados).toEqual({ nombre: 'Resuelto', color: '#0f0' });
    });

    it('returns empty objects for state aliases when transicion_id is null', async () => {
        const context = await buildEmailTemplateContext({
            entity: makeCaseStub({ transicion_id: { value: null } }),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
            stateFinder: makeStateFinder({}),
            transitionFinder: makeTransitionFinder({}),
        });

        expect(context.estados).toEqual({});
        expect(context.estados_actual).toEqual({});
        expect(context.estados_siguiente).toEqual({});
        expect(replaceTemplateVariables('Hi {{estados.nombre}}', context)).toBe('Hi ');
    });

    it('returns empty objects when stateFinder/transitionFinder are not provided', async () => {
        const context = await buildEmailTemplateContext({
            entity: makeCaseStub(),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
        });

        expect(context.estados).toEqual({});
        expect(context.estados_actual).toEqual({});
        expect(context.estados_siguiente).toEqual({});
    });

    // Regression test: reproduces the bug reported by QA on 2026-07-15 where
    // the template "Prueba QA con estado de caso" rendered "Estado caso - de color"
    // because stateRepository and transitionRepository were not wired at the
    // ActionExecutor instantiation site. When the finders ARE wired (as
    // expected after the deployment follow-up), the placeholders resolve to
    // the case's next-state name and color.
    it('renders the QA regression template with state name and color when finders are wired', async () => {
        const transitionFinder = makeTransitionFinder({
            'trans-1': { estado_actual_id: 'a-1', siguiente_estado_id: 's-1' },
        });
        const stateFinder = makeStateFinder({
            'a-1': { nombre: 'En revisión', color: '#aaa' },
            's-1': { nombre: 'Resuelto', color: '#0f0' },
        });

        const context = await buildEmailTemplateContext({
            entity: makeCaseStub(),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
            stateFinder,
            transitionFinder,
        });

        const qaCuerpo = '<p>Estado caso - {{estados.nombre}} de color {{estados.color}}</p>';
        const rendered = replaceTemplateVariables(qaCuerpo, context);

        expect(rendered).toBe('<p>Estado caso - Resuelto de color #0f0</p>');
        expect(rendered).not.toContain('{{Unknown}}');
        expect(rendered).not.toContain('{{estados.nombre}}');
        expect(rendered).not.toContain('{{estados.color}}');
    });
});
