import { jest } from '@jest/globals';

import { TransitionConditionLabeler } from '../../src/transition-rules/domain/TransitionConditionLabeler.js';

const CAMILO = '11111111-1111-4111-8111-111111111111';
const PEDRO = '22222222-2222-4222-8222-222222222222';
const SOPORTE_N2 = '33333333-3333-4333-8333-333333333333';
const CERRADO = '44444444-4444-4444-8444-444444444444';
const QUEJA = '55555555-5555-4555-8555-555555555555';

const labelsSource = (labels = {}) => ({
    findReferenceLabels: jest.fn(async () => ({
        users: { [CAMILO]: 'Camilo Londoño', [PEDRO]: 'Pedro Pérez' },
        groups: { [SOPORTE_N2]: 'Soporte N2' },
        states: { [CERRADO]: 'Cerrado' },
        classifications: { [QUEJA]: 'Quejas -> Facturación' },
        ...labels,
    })),
});

const diagnosticOf = (...failed) => ({ combinator: 'and', failed });

describe('TransitionConditionLabeler', () => {
    it('names the user a responsable condition expects and the one the case has', async () => {
        const diagnostic = diagnosticOf({
            field: 'cases.responsable_id',
            operator: '=',
            value_type: 'text',
            expected: CAMILO,
            actual: PEDRO,
        });

        const labeled = await TransitionConditionLabeler.label(diagnostic, labelsSource());

        expect(labeled.failed[0]).toEqual({
            field: 'cases.responsable_id',
            operator: '=',
            value_type: 'text',
            expected: CAMILO,
            actual: PEDRO,
            expected_label: 'Camilo Londoño',
            actual_label: 'Pedro Pérez',
        });
    });

    it.each([
        ['cases.grupo_id', SOPORTE_N2, 'Soporte N2'],
        ['cases.estadoActual', CERRADO, 'Cerrado'],
        ['estados.id', CERRADO, 'Cerrado'],
        ['cases.clasificacion_id', QUEJA, 'Quejas -> Facturación'],
        ['clasificaciones.id', QUEJA, 'Quejas -> Facturación'],
        ['clasificaciones.description', QUEJA, 'Quejas -> Facturación'],
        ['cases.closed_by', CAMILO, 'Camilo Londoño'],
    ])('names the entity referenced by %s', async (field, id, label) => {
        const labeled = await TransitionConditionLabeler.label(
            diagnosticOf({ field, operator: '=', value_type: 'text', expected: id }),
            labelsSource()
        );

        expect(labeled.failed[0].expected_label).toBe(label);
    });

    it('names every element of a list operand', async () => {
        const labeled = await TransitionConditionLabeler.label(
            diagnosticOf({
                field: 'cases.responsable_id',
                operator: 'in',
                value_type: 'text',
                expected: [CAMILO, PEDRO],
            }),
            labelsSource()
        );

        expect(labeled.failed[0].expected_label).toEqual(['Camilo Londoño', 'Pedro Pérez']);
    });

    it('asks the source once, with the ids of every condition grouped by entity', async () => {
        const source = labelsSource();

        await TransitionConditionLabeler.label(
            diagnosticOf(
                {
                    field: 'cases.responsable_id',
                    operator: 'in',
                    value_type: 'text',
                    expected: [CAMILO],
                    actual: PEDRO,
                },
                { field: 'cases.grupo_id', operator: '=', value_type: 'text', expected: SOPORTE_N2, actual: null }
            ),
            source
        );

        expect(source.findReferenceLabels).toHaveBeenCalledTimes(1);
        expect(source.findReferenceLabels).toHaveBeenCalledWith({
            users: [CAMILO, PEDRO],
            groups: [SOPORTE_N2],
        });
    });

    it('leaves the id alone when the entity no longer exists', async () => {
        const labeled = await TransitionConditionLabeler.label(
            diagnosticOf({
                field: 'cases.responsable_id',
                operator: '=',
                value_type: 'text',
                expected: CAMILO,
                actual: PEDRO,
            }),
            labelsSource({ users: { [PEDRO]: 'Pedro Pérez' } })
        );

        expect(labeled.failed[0]).not.toHaveProperty('expected_label');
        expect(labeled.failed[0].actual_label).toBe('Pedro Pérez');
    });

    it('keeps the id of a list element it cannot name, so the list stays aligned', async () => {
        const labeled = await TransitionConditionLabeler.label(
            diagnosticOf({
                field: 'cases.responsable_id',
                operator: 'in',
                value_type: 'text',
                expected: [CAMILO, PEDRO],
            }),
            labelsSource({ users: { [PEDRO]: 'Pedro Pérez' } })
        );

        expect(labeled.failed[0].expected_label).toEqual([CAMILO, 'Pedro Pérez']);
    });

    /**
     * Un operando oculto por la allowlist de `RuleValidator` no viaja en el diagnóstico: el
     * etiquetador no puede reintroducirlo con nombre.
     */
    it('never names an operand the diagnostic redacted', async () => {
        const source = labelsSource();

        const labeled = await TransitionConditionLabeler.label(
            diagnosticOf({
                field: 'cases.responsable_id',
                operator: '=',
                value_type: 'text',
                expected: CAMILO,
                redacted: true,
            }),
            source
        );

        expect(labeled.failed[0]).not.toHaveProperty('actual_label');
        expect(source.findReferenceLabels).toHaveBeenCalledWith({ users: [CAMILO] });
    });

    it('does not query when no failed condition references an entity', async () => {
        const source = labelsSource();
        const diagnostic = diagnosticOf({
            field: 'cases.motivo_baja',
            operator: '=',
            value_type: 'text',
            expected: 'X',
            actual: 'Y',
        });

        const labeled = await TransitionConditionLabeler.label(diagnostic, source);

        expect(source.findReferenceLabels).not.toHaveBeenCalled();
        expect(labeled).toBe(diagnostic);
    });

    it('ignores empty operands', async () => {
        const source = labelsSource();

        await TransitionConditionLabeler.label(
            diagnosticOf({ field: 'cases.responsable_id', operator: 'notNull', value_type: 'text', actual: null }),
            source
        );

        expect(source.findReferenceLabels).not.toHaveBeenCalled();
    });

    it('returns a missing diagnostic untouched', async () => {
        await expect(TransitionConditionLabeler.label(null, labelsSource())).resolves.toBeNull();
    });
});
