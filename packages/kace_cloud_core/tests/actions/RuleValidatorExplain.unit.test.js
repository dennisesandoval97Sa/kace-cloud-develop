import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule';
import { InvalidArgumentError } from '../../src/shared';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator';
import { RuleValidator } from '../../src/actions/domain/QueryTranslator/RuleValidator';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog';

/**
 * API-RULES (MSKT-1392) — `RuleValidator.explain`.
 *
 * Dos cosas que comprobar, y la segunda importa tanto como la primera: que el diagnóstico nombra
 * la condición que falla, y que su veredicto coincide con el de `validate`, que es el que
 * consumen nueve llamadores y no puede cambiar. Cada caso se afirma contra los dos.
 */
describe('RuleValidator.explain', () => {
    const context = {
        cases: { titulo: 'Reclamo', alto_impacto: false },
        clients: { nombres: 'Ana' },
        aux_cases: { monto: 40 },
    };

    const composite = (rules, combinator = 'and') => CompositeRule.fromValue({ combinator, rules });

    const condition = (overrides = {}) => ({
        field: 'cases.titulo',
        operator: RuleOperator.EQUALS,
        value: 'Reclamo',
        type: 'manual_input',
        ...overrides,
    });

    const explainAndValidate = (rule, kase = null) => {
        const diagnostic = RuleValidator.explain(rule, context, kase);
        expect(diagnostic.satisfied).toBe(RuleValidator.validate(rule, context, kase));
        return diagnostic;
    };

    describe('simple rule', () => {
        it('reports no failure when the condition holds', () => {
            const diagnostic = explainAndValidate(Rule.fromValue(condition()));

            expect(diagnostic).toEqual({ satisfied: true, combinator: null, failed: [] });
        });

        it('names the field, the operator, the expected value and the actual one', () => {
            const diagnostic = explainAndValidate(Rule.fromValue(condition({ value: 'Consulta' })));

            expect(diagnostic.satisfied).toBe(false);
            expect(diagnostic.combinator).toBeNull();
            expect(diagnostic.failed).toEqual([
                {
                    field: 'cases.titulo',
                    operator: RuleOperator.EQUALS,
                    value_type: 'text',
                    expected: 'Consulta',
                    actual: 'Reclamo',
                },
            ]);
        });

        it('reports a missing field as a null actual value', () => {
            const diagnostic = explainAndValidate(
                Rule.fromValue(condition({ field: 'cases.motivo_baja', value: 'algo' }))
            );

            expect(diagnostic.failed).toEqual([
                expect.objectContaining({ field: 'cases.motivo_baja', actual: null, expected: 'algo' }),
            ]);
        });
    });

    describe('composite rule', () => {
        it('reports only the condition that breaks an AND', () => {
            const diagnostic = explainAndValidate(
                composite([condition(), condition({ field: 'clients.nombres', value: 'Beatriz' })])
            );

            expect(diagnostic.satisfied).toBe(false);
            expect(diagnostic.combinator).toBe('and');
            expect(diagnostic.failed).toEqual([
                expect.objectContaining({ field: 'clients.nombres', expected: 'Beatriz', redacted: true }),
            ]);
        });

        it('reports nothing when the AND holds', () => {
            const diagnostic = explainAndValidate(
                composite([condition(), condition({ field: 'clients.nombres', value: 'Ana' })])
            );

            expect(diagnostic).toEqual({ satisfied: true, combinator: 'and', failed: [] });
        });

        it('reports every branch of an unmet OR, because none of them suffices on its own', () => {
            const diagnostic = explainAndValidate(
                composite(
                    [condition({ value: 'Consulta' }), condition({ field: 'clients.nombres', value: 'Beatriz' })],
                    'or'
                )
            );

            expect(diagnostic.satisfied).toBe(false);
            expect(diagnostic.combinator).toBe('or');
            expect(diagnostic.failed).toHaveLength(2);
        });

        it('reports nothing when one branch of an OR holds', () => {
            const diagnostic = explainAndValidate(
                composite([condition(), condition({ field: 'clients.nombres', value: 'Beatriz' })], 'or')
            );

            expect(diagnostic).toEqual({ satisfied: true, combinator: 'or', failed: [] });
        });

        it('flattens the failures of a nested composite', () => {
            const diagnostic = explainAndValidate(
                composite([
                    condition(),
                    {
                        combinator: 'and',
                        rules: [
                            condition({ field: 'clients.nombres', value: 'Beatriz' }),
                            condition({
                                field: 'aux_cases.monto',
                                operator: RuleOperator.GREATER_THAN_EQUAL,
                                value: '100',
                                value_type: 'number',
                            }),
                        ],
                    },
                ])
            );

            expect(diagnostic.satisfied).toBe(false);
            expect(diagnostic.failed.map((failure) => failure.field)).toEqual(['clients.nombres', 'aux_cases.monto']);
        });

        it('rejects an unsupported combinator exactly like validate does', () => {
            const rule = composite([condition()]);
            // `RuleCombinator` no admite construir un combinador inválido, así que la única forma
            // de llegar a esa rama es la que produciría una regla persistida corrupta.
            const corrupted = Object.create(CompositeRule.prototype);
            Object.assign(corrupted, { rules: rule.rules, combinator: { value: 'xor' } });

            expect(() => RuleValidator.explain(corrupted, context)).toThrow(InvalidArgumentError);
            expect(() => RuleValidator.validate(corrupted, context)).toThrow(InvalidArgumentError);
        });
    });

    describe('guards', () => {
        it('rejects anything that is not a rule', () => {
            expect(() => RuleValidator.explain({ combinator: 'and' }, context)).toThrow(InvalidArgumentError);
        });

        it('rejects a context that is not an object', () => {
            expect(() => RuleValidator.explain(Rule.fromValue(condition()), null)).toThrow(InvalidArgumentError);
        });
    });

    /**
     * El diagnóstico viaja al cliente por `TransitionConditionsNotMetError.toPublicData()`, y ese
     * canal sobrevive al modo seguro de producción. Un valor del contexto que no pertenezca al
     * alcance del asesor NO puede salir por ahí: la condición se nombra, el dato se omite.
     */
    describe('redaction of non-publishable namespaces', () => {
        it('omits the actual value of a client field and marks the condition as redacted', () => {
            const diagnostic = explainAndValidate(
                Rule.fromValue(condition({ field: 'clients.nombres', value: 'Beatriz' }))
            );

            expect(diagnostic.failed).toEqual([
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.EQUALS,
                    value_type: 'text',
                    expected: 'Beatriz',
                    redacted: true,
                },
            ]);
            expect(diagnostic.failed[0]).not.toHaveProperty('actual');
        });

        it.each(['clients.nombres', 'aux_clients.documento', 'aux_users.salario', 'aux_cases.monto'])(
            'never publishes the value of %s',
            (field) => {
                const diagnostic = RuleValidator.explain(
                    Rule.fromValue(condition({ field, value: 'otro' })),
                    { ...context, aux_clients: { documento: '1020304050' }, aux_users: { salario: 9000 } },
                    null
                );

                expect(diagnostic.failed[0]).not.toHaveProperty('actual');
                expect(diagnostic.failed[0].redacted).toBe(true);
            }
        );

        it('publishes the value of a case field, which the agent already has in the form', () => {
            const diagnostic = explainAndValidate(Rule.fromValue(condition({ value: 'Consulta' })));

            expect(diagnostic.failed[0]).toEqual({
                field: 'cases.titulo',
                operator: RuleOperator.EQUALS,
                value_type: 'text',
                expected: 'Consulta',
                actual: 'Reclamo',
            });
            expect(diagnostic.failed[0]).not.toHaveProperty('redacted');
        });

        it('publishes the value of an SLA field of the case', () => {
            const kase = {
                VALID_TRANSITIONS_SLA_FIELDS: ['casos.antiguedad_dias'],
                slaFieldResolvers: { 'casos.antiguedad_dias': () => 3 },
            };
            const diagnostic = explainAndValidate(
                Rule.fromValue(
                    condition({
                        field: 'casos.antiguedad_dias',
                        operator: RuleOperator.GREATER_THAN,
                        value: '10',
                        value_type: 'number',
                    })
                ),
                kase
            );

            expect(diagnostic.failed[0]).toEqual(
                expect.objectContaining({ field: 'casos.antiguedad_dias', actual: 3 })
            );
        });

        /**
         * `type: 'entity'` hace que el "esperado" NO sea un literal del administrador sino otro
         * campo del contexto. Se juzga por su propio origen, o la comparación contra un dato del
         * cliente lo publicaría por la puerta de atrás.
         */
        it('omits an expected value that resolves to a non-publishable field', () => {
            const diagnostic = explainAndValidate(
                Rule.fromValue(condition({ field: 'cases.titulo', value: 'clients.nombres', type: 'entity' }))
            );

            expect(diagnostic.failed[0]).toEqual({
                field: 'cases.titulo',
                operator: RuleOperator.EQUALS,
                value_type: 'text',
                actual: 'Reclamo',
                redacted: true,
            });
            expect(diagnostic.failed[0]).not.toHaveProperty('expected');
        });

        it('publishes an expected value that resolves to a publishable field', () => {
            const diagnostic = explainAndValidate(
                Rule.fromValue(condition({ field: 'cases.titulo', value: 'cases.alto_impacto', type: 'entity' }))
            );

            expect(diagnostic.failed[0]).toEqual(expect.objectContaining({ expected: false, actual: 'Reclamo' }));
            expect(diagnostic.failed[0]).not.toHaveProperty('redacted');
        });

        it('publishes the value of a state field, a configuration catalogue', () => {
            const diagnostic = RuleValidator.explain(
                Rule.fromValue(condition({ field: 'estados.nombre', value: 'Cerrado' })),
                { ...context, estados: { nombre: 'Abierto' } }
            );

            expect(diagnostic.failed[0]).toEqual({
                field: 'estados.nombre',
                operator: RuleOperator.EQUALS,
                value_type: 'text',
                expected: 'Cerrado',
                actual: 'Abierto',
            });
            expect(diagnostic.failed[0]).not.toHaveProperty('redacted');
        });

        it('publishes the value of a classification field, a configuration catalogue', () => {
            const diagnostic = RuleValidator.explain(
                Rule.fromValue(condition({ field: 'clasificaciones.nivel1', value: 'Venta efectiva' })),
                { ...context, clasificaciones: { nivel1: 'Venta no efectiva' } }
            );

            expect(diagnostic.failed[0]).toEqual({
                field: 'clasificaciones.nivel1',
                operator: RuleOperator.EQUALS,
                value_type: 'text',
                expected: 'Venta efectiva',
                actual: 'Venta no efectiva',
            });
            expect(diagnostic.failed[0]).not.toHaveProperty('redacted');
        });

        it('denies by default a namespace that is not in the allowlist', () => {
            expect(RuleValidator.isPublishableField('otra_tabla.campo')).toBe(false);
            expect(RuleValidator.isPublishableField('sin_namespace')).toBe(false);
            expect(RuleValidator.isPublishableField('')).toBe(false);
            expect(RuleValidator.isPublishableField(null)).toBe(false);
        });
    });

    /**
     * La allowlist no se deriva de `FieldCatalog` a propósito: derivarla invertiría el sesgo —un
     * namespace nuevo del catálogo entraría publicándose por omisión— y el fail-closed es justo lo
     * que protege este diagnóstico. Lo que sí hay que sostener es la coherencia entre las dos
     * listas, y eso es lo que fija este test.
     */
    describe('consistency with the cases field catalogue', () => {
        const catalog = createCasesFieldCatalog();
        /** `casos.*` son los campos de SLA del caso, que resuelve el propio `RuleValidator`. */
        const SLA_NAMESPACE = 'casos';

        it('every allowlisted namespace exists in the catalogue', () => {
            const known = new Set([...Object.keys(catalog.columnTables), ...Object.keys(catalog.jsonPrefixes)]);

            const missing = RuleValidator.PUBLISHABLE_FIELD_NAMESPACES.filter(
                (namespace) => namespace !== SLA_NAMESPACE && !known.has(namespace)
            );

            expect(missing).toEqual([]);
        });

        it('keeps every namespace carrying third-party or tenant-defined data out of the allowlist', () => {
            const sensitive = ['clients', ...Object.keys(catalog.jsonPrefixes)];

            for (const namespace of sensitive) {
                expect(RuleValidator.PUBLISHABLE_FIELD_NAMESPACES).not.toContain(namespace);
            }
        });

        /**
         * Un namespace nuevo en el catálogo no se publica solo: entra redactado hasta que alguien
         * lo añada a la allowlist a propósito. Si este test empieza a fallar es que la allowlist
         * creció, y hay que revisar si ese dato puede viajar en un 400.
         */
        it('leaves every other catalogue namespace redacted by default', () => {
            const known = [...Object.keys(catalog.columnTables), ...Object.keys(catalog.jsonPrefixes)];

            for (const namespace of known) {
                const expected = RuleValidator.PUBLISHABLE_FIELD_NAMESPACES.includes(namespace);
                expect(RuleValidator.isPublishableField(`${namespace}.cualquier_campo`)).toBe(expected);
            }
        });
    });

    describe('publicOperand', () => {
        it('keeps primitives as they are', () => {
            expect(RuleValidator.publicOperand('texto')).toBe('texto');
            expect(RuleValidator.publicOperand(7)).toBe(7);
            expect(RuleValidator.publicOperand(false)).toBe(false);
        });

        it('collapses null and undefined into null', () => {
            expect(RuleValidator.publicOperand(null)).toBeNull();
            expect(RuleValidator.publicOperand(undefined)).toBeNull();
        });

        it('caps an array so a large IN list cannot flood the response', () => {
            const operand = RuleValidator.publicOperand(Array.from({ length: 30 }, (_, index) => index));

            expect(operand).toHaveLength(20);
        });

        /**
         * El contexto del caso trae objetos enteros (una fila auxiliar, un valor JSON). Quien
         * lee el diagnóstico necesita reconocer el DATO: `"[object Object]"` -lo que devolvía
         * `String(objeto)`- no le dice nada.
         */
        it('serializes an object instead of publishing [object Object]', () => {
            const operand = RuleValidator.publicOperand({ monto: 1500, moneda: 'COP' });

            expect(operand).toBe('{"monto":1500,"moneda":"COP"}');
        });

        it('publishes a date as an ISO string', () => {
            const operand = RuleValidator.publicOperand(new Date('2026-09-16T12:00:00.000Z'));

            expect(operand).toBe('2026-09-16T12:00:00.000Z');
        });

        it('truncates a large object instead of publishing the whole context', () => {
            const operand = RuleValidator.publicOperand({ nota: 'x'.repeat(500) });

            expect(operand).toHaveLength(200);
        });

        // Un campo de texto del caso llega como cadena suelta, no envuelto en un objeto: sin
        // recorte se devolvería íntegro en el cuerpo del 400.
        it('truncates a large string as it truncates a large object', () => {
            const operand = RuleValidator.publicOperand('x'.repeat(500));

            expect(operand).toHaveLength(200);
        });

        it('leaves a string within the cap untouched', () => {
            expect(RuleValidator.publicOperand('x'.repeat(200))).toHaveLength(200);
        });

        // El diagnóstico es información añadida sobre un rechazo ya decidido: un objeto que no
        // se puede serializar no puede tumbarlo.
        it('falls back to the default representation for a cyclic object', () => {
            const cyclic = { nombre: 'ciclo' };
            cyclic.self = cyclic;

            expect(RuleValidator.publicOperand(cyclic)).toBe('[object Object]');
        });
    });
});
