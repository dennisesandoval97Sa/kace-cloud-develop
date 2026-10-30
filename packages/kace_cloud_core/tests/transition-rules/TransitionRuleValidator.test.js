import { jest } from '@jest/globals';

import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { TransitionRuleValidator } from '../../src/transition-rules/domain/TransitionRuleValidator.js';
import { TransitionRule } from '../../src/transition-rules/domain/TransitionRule.js';
import { TransitionConditionsNotMetError } from '../../src/transition-rules/domain/TransitionConditionsNotMetError.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { CASE_TRANSITION_CONDITIONS_NOT_MET } from '@kace/error-codes';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator.js';
import { TransitionRuleMother } from './domain/TransitionRuleMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother.js';
import { AuxClientsMother } from '../aux_clientes/domain/AuxClientsMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { Case } from '../../src/cases/index.js';

describe('TransitionRuleValidator', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);

    const fakeContext = {
        cases: CasesMother.dto(),
        clients: ClientMother.dto(),
        aux_cases: AuxCasesMother.dto().data,
        aux_clients: { ...AuxClientsMother.dto().data, cliente: ClientMother.dto() },
        clasificaciones: ClassificationsMother.dto(),
    };

    jest.spyOn(caseRepository, 'getCasoInfo').mockImplementation(async () => fakeContext);
    jest.spyOn(caseRepository, 'buildCaseContextFromDto').mockImplementation(async () => fakeContext);

    describe('validateFromCase', () => {
        it('returns true when conditions match the case context', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(true);
        });

        it('returns false when conditions do not match the case context', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreQueNoExiste',
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(false);
        });

        it('returns true with OR combinator when at least one condition matches', async () => {
            const conditions = {
                combinator: 'or',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreQueNoExiste',
                        type: 'manual_input',
                    },
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(true);
        });

        it('returns false when all OR conditions fail', async () => {
            const conditions = {
                combinator: 'or',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreA',
                        type: 'manual_input',
                    },
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreB',
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(false);
        });

        it('returns true with entity-type rule when referenced path matches', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'aux_clients.cliente.nombres',
                        type: 'entity',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(true);
        });

        it('returns false when entity-type referenced path does not exist', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'aux_clients.cliente.campoInexistente',
                        type: 'entity',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(false);
        });

        it('validates nested conditions with multiple combinators', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.CONTAINS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                    {
                        combinator: 'or',
                        rules: [
                            {
                                field: 'clients.apellido1',
                                operator: RuleOperator.EQUALS,
                                value: 'NombreQueNoExiste',
                                type: 'manual_input',
                            },
                            {
                                field: 'clients.apellido1',
                                operator: RuleOperator.EQUALS,
                                value: fakeContext.clients.apellido1,
                                type: 'manual_input',
                            },
                        ],
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(true);
        });
    });

    describe('validateFromDto', () => {
        it('returns true when conditions match the DTO context', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const dto = CasesMother.dto();

            const result = await TransitionRuleValidator.validateFromDto(dto, rule, caseRepository);

            expect(result).toBe(true);
        });

        it('returns false when conditions do not match the DTO context', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreQueNoExiste',
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const dto = CasesMother.dto();

            const result = await TransitionRuleValidator.validateFromDto(dto, rule, caseRepository);

            expect(result).toBe(false);
        });

        it('calls buildCaseContextFromDto with the provided dto', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const dto = CasesMother.dto();

            await TransitionRuleValidator.validateFromDto(dto, rule, caseRepository);

            expect(caseRepository.buildCaseContextFromDto).toHaveBeenCalledWith(dto);
        });

        it('calls getCasoInfo with the case entity in validateFromCase', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(caseRepository.getCasoInfo).toHaveBeenCalledWith(kase);
        });
    });

    describe('cases.estadoActual mapping', () => {
        const estadoId = 'estado-uuid-1';
        const contextWithEstado = {
            ...fakeContext,
            estados: { id: estadoId, nombre: 'En proceso' },
        };

        it('validateFromDto returns true when estadoActual matches estados.id', async () => {
            caseRepository.buildCaseContextFromDto.mockImplementationOnce(async () => contextWithEstado);
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: estadoId,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));

            const result = await TransitionRuleValidator.validateFromDto(CasesMother.dto(), rule, caseRepository);

            expect(result).toBe(true);
        });

        it('validateFromDto returns false when estadoActual does not match', async () => {
            caseRepository.buildCaseContextFromDto.mockImplementationOnce(async () => contextWithEstado);
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: 'otro-estado-uuid',
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));

            const result = await TransitionRuleValidator.validateFromDto(CasesMother.dto(), rule, caseRepository);

            expect(result).toBe(false);
        });

        it('validateFromDto returns false when the context lacks estados (regression guard)', async () => {
            caseRepository.buildCaseContextFromDto.mockImplementationOnce(async () => fakeContext);
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: estadoId,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));

            const result = await TransitionRuleValidator.validateFromDto(CasesMother.dto(), rule, caseRepository);

            expect(result).toBe(false);
        });

        it('validateFromCase returns true when estadoActual matches estados.id via getCasoInfo', async () => {
            caseRepository.getCasoInfo.mockImplementationOnce(async () => contextWithEstado);
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: estadoId,
                        type: 'manual_input',
                    },
                ],
            };
            const rule = new TransitionRule(TransitionRuleMother.dto({ conditions }));
            const kase = new Case(CasesMother.dto());

            const result = await TransitionRuleValidator.validateFromCase(kase, rule, caseRepository);

            expect(result).toBe(true);
        });
    });

    /**
     * API-RULES (MSKT-1392) — el bloqueo por reglas lleva ahora el motivo.
     *
     * El mensaje y el código NO cambian: `caseService.js` y `KaceData.js` del plugin lo traducen
     * por clave exacta y `getTranslatedError.js` de la SPA por substring. El motivo viaja en
     * `toPublicData()`, que es el único canal que sobrevive al saneamiento de producción.
     */
    describe('rule enforcement diagnostic', () => {
        const RULE_ID = '4f1d4c4e-9b1a-4c4e-8c1a-0a1b2c3d4e5f';
        const TRANSITION_ID = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

        const failingConditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.EQUALS,
                    value: 'NombreQueNoExiste',
                    type: 'manual_input',
                },
            ],
        };

        const repos = (conditions = failingConditions, transition = { id: TRANSITION_ID, rule_id: RULE_ID }) => ({
            transitionsCaseRepo: { findById: jest.fn(async () => transition) },
            transitionRuleRepo: {
                find: jest.fn(async () => new TransitionRule(TransitionRuleMother.dto({ id: RULE_ID, conditions }))),
            },
        });

        const enforce = ({ transitionsCaseRepo, transitionRuleRepo }, caseOrDto = new Case(CasesMother.dto())) =>
            TransitionRuleValidator.enforceRuleForTransition(
                TRANSITION_ID,
                transitionsCaseRepo,
                transitionRuleRepo,
                caseOrDto,
                caseRepository
            );

        it('keeps the legacy message and public code that three consumers match on', async () => {
            const error = await enforce(repos()).catch((thrown) => thrown);

            expect(error.message).toBe('The conditions configured for this transition are not met');
            expect(error.field).toBe('transition_id');
            expect(error.publicErrorCode).toBe(CASE_TRANSITION_CONDITIONS_NOT_MET);
        });

        it('is still a ValidationFailError, so no existing caller sees a different failure', async () => {
            await expect(enforce(repos())).rejects.toBeInstanceOf(ValidationFailError);
            await expect(enforce(repos())).rejects.toBeInstanceOf(TransitionConditionsNotMetError);
        });

        it('names the condition that failed in the data it publishes', async () => {
            const error = await enforce(repos()).catch((thrown) => thrown);

            expect(error.toPublicData()).toEqual({
                conditions: {
                    combinator: 'and',
                    failed: [
                        {
                            field: 'clients.nombres',
                            operator: RuleOperator.EQUALS,
                            value_type: 'text',
                            expected: 'NombreQueNoExiste',
                            redacted: true,
                        },
                    ],
                },
            });
        });

        /**
         * `toPublicData()` sobrevive al modo seguro de producción, así que es la superficie por la
         * que un dato del titular saldría del tenant. Se afirma sobre el JSON serializado y no
         * sobre el objeto: es exactamente lo que llegaría al cliente.
         */
        it('never publishes the value of a client field, not even truncated', async () => {
            const error = await enforce(repos()).catch((thrown) => thrown);

            expect(JSON.stringify(error.toPublicData())).not.toContain(fakeContext.clients.nombres);
        });

        it('publishes the value of a case field, which is within the agent scope', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.motivo_baja',
                        operator: RuleOperator.EQUALS,
                        value: 'MOTIVO-INEXISTENTE',
                        type: 'manual_input',
                    },
                ],
            };

            const error = await enforce(repos(conditions)).catch((thrown) => thrown);

            expect(error.toPublicData().conditions.failed).toEqual([
                {
                    field: 'cases.motivo_baja',
                    operator: RuleOperator.EQUALS,
                    value_type: 'text',
                    expected: 'MOTIVO-INEXISTENTE',
                    actual: fakeContext.cases.motivo_baja,
                },
            ]);
        });

        it('still rejects with the same error when the diagnostic cannot be built', async () => {
            caseRepository.getCasoInfo
                .mockImplementationOnce(async () => fakeContext)
                .mockImplementationOnce(async () => {
                    throw new Error('context unavailable');
                });

            const error = await enforce(repos()).catch((thrown) => thrown);

            expect(error).toBeInstanceOf(TransitionConditionsNotMetError);
            expect(error.message).toBe('The conditions configured for this transition are not met');
            expect(error.diagnostic).toBeNull();
            expect(error.toPublicData()).toEqual({});
        });

        it('diagnoses a dto the same way, from the dto context', async () => {
            const dto = CasesMother.dto();
            const { transitionsCaseRepo, transitionRuleRepo } = repos();

            const error = await TransitionRuleValidator.enforceRuleForTransition(
                TRANSITION_ID,
                transitionsCaseRepo,
                transitionRuleRepo,
                dto,
                caseRepository,
                'dto'
            ).catch((thrown) => thrown);

            expect(caseRepository.buildCaseContextFromDto).toHaveBeenCalledWith(dto);
            expect(error.diagnostic.failed).toEqual([expect.objectContaining({ field: 'clients.nombres' })]);
        });

        it('does not reject when the conditions are met', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            };

            await expect(enforce(repos(conditions))).resolves.toBeUndefined();
        });

        it('does not reject when the transition carries no rule', async () => {
            await expect(
                enforce(repos(failingConditions, { id: TRANSITION_ID, rule_id: null }))
            ).resolves.toBeUndefined();
        });

        describe('names the entities the failed conditions reference', () => {
            const CAMILO = '11111111-1111-4111-8111-111111111111';
            const responsableConditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.responsable_id',
                        operator: RuleOperator.EQUALS,
                        value: CAMILO,
                        type: 'manual_input',
                    },
                ],
            };

            afterEach(() => {
                caseRepository.findReferenceLabels?.mockRestore?.();
            });

            it('publishes the name of the user the rule expects and of the one the case has', async () => {
                jest.spyOn(caseRepository, 'findReferenceLabels').mockImplementation(async () => ({
                    users: { [CAMILO]: 'Camilo Londoño', [fakeContext.cases.responsable_id]: 'Pedro Pérez' },
                }));

                const error = await enforce(repos(responsableConditions)).catch((thrown) => thrown);

                expect(error.toPublicData().conditions.failed).toEqual([
                    expect.objectContaining({
                        field: 'cases.responsable_id',
                        expected: CAMILO,
                        expected_label: 'Camilo Londoño',
                        actual_label: 'Pedro Pérez',
                    }),
                ]);
            });

            it('names them in the merged context variant too', async () => {
                jest.spyOn(caseRepository, 'findReferenceLabels').mockImplementation(async () => ({
                    users: { [CAMILO]: 'Camilo Londoño' },
                }));
                const { transitionsCaseRepo, transitionRuleRepo } = repos(responsableConditions);

                const error = await TransitionRuleValidator.enforceRuleForTransitionWithMergedContext(
                    TRANSITION_ID,
                    transitionsCaseRepo,
                    transitionRuleRepo,
                    caseRepository,
                    { contextOverrides: { cases: { ...fakeContext.cases } } }
                ).catch((thrown) => thrown);

                expect(error.diagnostic.failed).toEqual([
                    expect.objectContaining({ expected: CAMILO, expected_label: 'Camilo Londoño' }),
                ]);
            });

            it('still rejects, with the ids, when the names cannot be read', async () => {
                jest.spyOn(caseRepository, 'findReferenceLabels').mockImplementation(async () => {
                    throw new Error('database unavailable');
                });

                const error = await enforce(repos(responsableConditions)).catch((thrown) => thrown);

                expect(error).toBeInstanceOf(TransitionConditionsNotMetError);
                expect(error.diagnostic.failed).toEqual([
                    expect.objectContaining({ field: 'cases.responsable_id', expected: CAMILO }),
                ]);
                expect(error.diagnostic.failed[0]).not.toHaveProperty('expected_label');
            });
        });

        // El campo es del namespace del caso a propósito: es el único con el que el valor
        // diagnosticado se puede afirmar, y afirmarlo es lo que demuestra que se usó el contexto
        // MEZCLADO y no el del repositorio.
        it('diagnoses the merged context variant from that same merged context', async () => {
            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.motivo_baja',
                        operator: RuleOperator.EQUALS,
                        value: 'MOTIVO-INEXISTENTE',
                        type: 'manual_input',
                    },
                ],
            };
            const { transitionsCaseRepo, transitionRuleRepo } = repos(conditions);

            const error = await TransitionRuleValidator.enforceRuleForTransitionWithMergedContext(
                TRANSITION_ID,
                transitionsCaseRepo,
                transitionRuleRepo,
                caseRepository,
                { contextOverrides: { cases: { ...fakeContext.cases, motivo_baja: 'OTRO-MOTIVO' } } }
            ).catch((thrown) => thrown);

            expect(error).toBeInstanceOf(TransitionConditionsNotMetError);
            expect(error.diagnostic.failed).toEqual([
                expect.objectContaining({ field: 'cases.motivo_baja', actual: 'OTRO-MOTIVO' }),
            ]);
        });
    });
});
