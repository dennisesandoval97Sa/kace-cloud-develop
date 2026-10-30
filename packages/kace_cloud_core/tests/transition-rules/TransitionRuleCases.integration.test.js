/**
 * Integration tests for TransitionRule enforcement inside CaseCreator, CaseUpdater, and CaseTransitionsUpdater.
 *
 * Strategy:
 *  - Real PostgreSQL DB (via knexConfig) — foreign keys ARE enforced, so every dto that gets
 *    persisted must be preceded by `CasesMother.ensureRelations`.
 *  - `getCasoInfo` and `buildCaseContextFromDto` are mocked because they are complex aggregate queries
 *    unrelated to rule enforcement logic (tested separately in TransitionRuleValidator.test.js).
 *  - `KnexTransitionRuleRepository` and `KnexTransitionsCaseRepository` are real — rules are actually
 *    persisted and looked up from the DB.
 */
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseCreator, CaseUpdater, CaseTransitionsUpdater, KnexCaseRepository } from '../../src/cases/index.js';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexTransitionRuleRepository } from '../../src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexStateRepository } from '../../src/state/index.js';
import { KnexFlowRepository } from '../../src/flow/index.js';
import { KnexUsersRepository, User } from '../../src/users/index.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator.js';

import { TransitionRuleMother } from './domain/TransitionRuleMother.js';
import { StateMother } from '../state/domain/StateMother.js';
import FlowsMother from '../flow/domain/FlowsMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother.js';
import { AuxClientsMother } from '../aux_clientes/domain/AuxClientsMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import UsersMother from '../users/domain/UsersMother.js';

const EMPTY_WRITE_OUTCOME = {
    transitionStaleAtWrite: false,
    responsableStaleAtWrite: false,
    clienteStaleAtWrite: false,
    clasificacionStaleAtWrite: false,
    grupoStaleAtWrite: false,
};

describe('TransitionRule enforcement — CaseCreator / CaseUpdater / CaseTransitionsUpdater', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const stateRepo = new KnexStateRepository(repository.connection);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const ruleRepo = new KnexTransitionRuleRepository(repository.connection);
    const transitionsCaseRepo = new KnexTransitionsCaseRepository(repository.connection);
    const usersRepo = new KnexUsersRepository(repository.connection);

    const actionExecutionServiceMock = { execute: jest.fn(async () => true) };

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    /** Context returned by the mocked repository methods */
    const fakeContext = {
        cases: CasesMother.dto(),
        clients: ClientMother.dto(),
        aux_cases: AuxCasesMother.dto().data,
        aux_clients: { ...AuxClientsMother.dto().data, cliente: ClientMother.dto() },
        clasificaciones: ClassificationsMother.dto(),
    };

    const getCasoInfoSpy = jest.spyOn(repository, 'getCasoInfo').mockResolvedValue(fakeContext);
    const buildContextSpy = jest.spyOn(repository, 'buildCaseContextFromDto').mockResolvedValue(fakeContext);

    beforeEach(async () => {
        jest.clearAllMocks();
        getCasoInfoSpy.mockResolvedValue(fakeContext);
        buildContextSpy.mockResolvedValue(fakeContext);
    });

    async function createMatchingRule() {
        return TransitionRuleMother.create(ruleRepo, {
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: fakeContext.clients.nombres,
                        type: 'manual_input',
                    },
                ],
            },
        });
    }

    /** Creates a rule with conditions that do NOT match fakeContext */
    async function createNonMatchingRule() {
        return TransitionRuleMother.create(ruleRepo, {
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        field: 'clients.nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'NombreQueNoCoincide',
                        type: 'manual_input',
                    },
                ],
            },
        });
    }

    /**
     * Builds A → B → C flow with two transitions.
     * Returns { T1, T2 } where T1 goes from A→B and T2 from B→C.
     * json_flujo is set on the flow so CaseTransitionsUpdater can find available transitions.
     */
    async function seedLinearFlow() {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const C = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);

        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const T2 = await TransitionsMother.createTransition(transitionRepo, B, flow, C);

        const json_flujo = {
            nodes: [{ id: A.id.value }, { id: B.id.value }, { id: C.id.value }],
            edges: [
                { id: 'edge-A-B', source: A.id.value, target: B.id.value, kace_transition: T1.id.value },
                { id: 'edge-B-C', source: B.id.value, target: C.id.value, kace_transition: T2.id.value },
                { id: 'edge-0-A', source: '0', target: A.id.value, kace_transition: T1.id.value },
            ],
        };

        await repository
            .connection('flujos')
            .update({ json_flujo: JSON.stringify(json_flujo) })
            .where({ id: flow.id.value });

        return { T1, T2 };
    }

    async function attachRuleToTransition(transitionId, ruleId) {
        await repository.connection('transiciones').update({ rule_id: ruleId }).where({ id: transitionId });
    }

    describe('CaseCreator', () => {
        it('allows case creation when rule conditions are met', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await createMatchingRule();
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const creator = new CaseCreator(
                repository,
                actionExecutionServiceMock,
                null,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            const dto = CasesMother.dto({ transicion_id: T1.id.value });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(creator.execute(dto)).resolves.toBeDefined();
        });

        it('rejects case creation when rule conditions are not met', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const creator = new CaseCreator(
                repository,
                actionExecutionServiceMock,
                null,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            const dto = CasesMother.dto({ transicion_id: T1.id.value });

            await expect(creator.execute(dto)).rejects.toThrow(ValidationFailError);
            await expect(creator.execute(dto)).rejects.toThrow(
                'The conditions configured for this transition are not met'
            );
        });

        it('skips rule validation when transition has no rule_id', async () => {
            const { T1 } = await seedLinearFlow();

            const creator = new CaseCreator(
                repository,
                actionExecutionServiceMock,
                null,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            const dto = CasesMother.dto({ transicion_id: T1.id.value });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(creator.execute(dto)).resolves.toBeDefined();
            expect(repository.buildCaseContextFromDto).not.toHaveBeenCalled();
        });

        it('skips rule validation when repositories are not provided', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const creator = new CaseCreator(repository, actionExecutionServiceMock, null, null, null);

            const dto = CasesMother.dto({ transicion_id: T1.id.value });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(creator.execute(dto)).resolves.toBeDefined();
            expect(repository.buildCaseContextFromDto).not.toHaveBeenCalled();
        });
    });

    describe('CaseUpdater', () => {
        it('allows case update when rule conditions are met', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                currentUser,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            await expect(
                updater.execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });

        it('rejects case update when rule conditions are not met', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                currentUser,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            const dto = { transicion_id: T2.id.value, updated_at: new Date() };

            await expect(updater.execute(kase.id.value, dto)).rejects.toThrow(ValidationFailError);
            await expect(updater.execute(kase.id.value, dto)).rejects.toThrow(
                'The conditions configured for this transition are not met'
            );
        });

        it('skips rule validation when transition has no rule_id', async () => {
            const { T1, T2 } = await seedLinearFlow();

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                currentUser,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );

            await expect(
                updater.execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
            expect(repository.getCasoInfo).not.toHaveBeenCalled();
        });

        it('skips rule validation when repositories are not provided', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseUpdater(repository, actionExecutionServiceMock, currentUser, null, null);

            await expect(
                updater.execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
            expect(repository.getCasoInfo).not.toHaveBeenCalled();
        });
    });

    /**
     * Helpers — used by suites that exercise the REAL context builders (no mocks).
     * The outer `beforeEach` re-installs `mockResolvedValue(fakeContext)` on the spies; the inner
     * beforeEach in each suite below overrides that with `mockImplementation` delegating to the
     * actual repository method, so we exercise the real query against PostgreSQL.
     */
    function useRealBuildCaseContextFromDto() {
        beforeEach(() => {
            buildContextSpy.mockImplementation((dto) =>
                KnexCaseRepository.prototype.buildCaseContextFromDto.call(repository, dto)
            );
        });
    }

    function useRealGetCasoInfo() {
        beforeEach(() => {
            getCasoInfoSpy.mockImplementation((kase) =>
                KnexCaseRepository.prototype.getCasoInfo.call(repository, kase)
            );
        });
    }

    function makeRule(conditions) {
        return TransitionRuleMother.create(ruleRepo, { conditions });
    }

    describe('CaseTransitionsUpdater', () => {
        it('allows transition when rule conditions are met', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseTransitionsUpdater(
                repository,
                transitionsCaseRepo,
                actionExecutionServiceMock,
                currentUser,
                ruleRepo
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
        });

        it('rejects transition when rule conditions are not met', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseTransitionsUpdater(
                repository,
                transitionsCaseRepo,
                actionExecutionServiceMock,
                currentUser,
                ruleRepo
            );

            await expect(updater.execute(kase.id.value, { transicion_id: T2.id.value })).rejects.toThrow(
                ValidationFailError
            );
            await expect(updater.execute(kase.id.value, { transicion_id: T2.id.value })).rejects.toThrow(
                'The conditions configured for this transition are not met'
            );

            const unchanged = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(unchanged.transicion_id).toBe(T1.id.value);
        });

        it('skips rule validation when transition has no rule_id', async () => {
            const { T1, T2 } = await seedLinearFlow();

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseTransitionsUpdater(
                repository,
                transitionsCaseRepo,
                actionExecutionServiceMock,
                currentUser,
                ruleRepo
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
            expect(repository.getCasoInfo).not.toHaveBeenCalled();
        });

        it('skips rule validation when transitionRuleRepository is not provided', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await createNonMatchingRule();
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            const updater = new CaseTransitionsUpdater(
                repository,
                transitionsCaseRepo,
                actionExecutionServiceMock,
                currentUser
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
            expect(repository.getCasoInfo).not.toHaveBeenCalled();
        });
    });

    describe('CaseCreator — cases entity filters (real buildCaseContextFromDto)', () => {
        useRealBuildCaseContextFromDto();

        function makeCreator() {
            return new CaseCreator(
                repository,
                actionExecutionServiceMock,
                null,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );
        }

        it('allows creation when cases.estadoActual matches the transition destination state', async () => {
            const { T1 } = await seedLinearFlow();
            const destinoId = T1.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: destinoId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(makeCreator().execute(dto)).resolves.toBeDefined();
        });

        it('rejects creation when cases.estadoActual does not match the destination state', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value });

            await expect(makeCreator().execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('allows creation when cases.alto_impacto equals the dto value', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, alto_impacto: 1 });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(makeCreator().execute(dto)).resolves.toBeDefined();
        });

        it('rejects creation when cases.alto_impacto does not match the dto value', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, alto_impacto: 0 });

            await expect(makeCreator().execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('allows creation when cases.cliente_id matches the dto value', async () => {
            const { T1 } = await seedLinearFlow();
            const clienteId = uuidv4();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.cliente_id',
                        operator: RuleOperator.EQUALS,
                        value: clienteId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, cliente_id: clienteId });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(makeCreator().execute(dto)).resolves.toBeDefined();
        });

        it('rejects creation when cases.motivo_baja does not contain the expected substring', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.motivo_baja',
                        operator: RuleOperator.CONTAINS,
                        value: 'cancelado',
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, motivo_baja: 'otro motivo' });

            await expect(makeCreator().execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('allows creation when an AND composite over cases.estadoActual + cases.alto_impacto matches', async () => {
            const { T1 } = await seedLinearFlow();
            const destinoId = T1.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: destinoId,
                        type: 'manual_input',
                    },
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, alto_impacto: 1 });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(makeCreator().execute(dto)).resolves.toBeDefined();
        });

        it('rejects creation when an AND composite fails on one of the cases.* conditions', async () => {
            const { T1 } = await seedLinearFlow();
            const destinoId = T1.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: destinoId,
                        type: 'manual_input',
                    },
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, alto_impacto: 0 });

            await expect(makeCreator().execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('allows creation when an OR composite over two cases.* fields matches at least one', async () => {
            const { T1 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'or',
                rules: [
                    {
                        field: 'cases.cliente_id',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T1.id.value, rule.id.value);

            const dto = CasesMother.dto({ transicion_id: T1.id.value, alto_impacto: 1 });
            await CasesMother.ensureRelations(repository.connection, dto, {});

            await expect(makeCreator().execute(dto)).resolves.toBeDefined();
        });
    });

    describe('CaseUpdater — cases entity filters (real getCasoInfo)', () => {
        useRealGetCasoInfo();

        function makeUpdater() {
            return new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                currentUser,
                null,
                null,
                ruleRepo,
                transitionsCaseRepo
            );
        }

        it('allows update when cases.estadoActual matches the destination state of the new transition', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const destinoT2 = T2.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: destinoT2,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });

        it('rejects update when cases.estadoActual does not match and leaves the case on T1', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).rejects.toThrow(ValidationFailError);

            const unchanged = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(unchanged.transicion_id).toBe(T1.id.value);
        });

        it('allows update when cases.responsable_id matches the persisted value', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const responsableId = uuidv4();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.responsable_id',
                        operator: RuleOperator.EQUALS,
                        value: responsableId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                responsable_id: responsableId,
            });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });

        it('rejects update when cases.responsable_id does not match', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.responsable_id',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).rejects.toThrow(ValidationFailError);
        });

        it('allows update when cases.grupo_id is within an IN list', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const grupoId = uuidv4();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.grupo_id',
                        operator: RuleOperator.IN,
                        value: `${grupoId},${uuidv4()}`,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                grupo_id: grupoId,
            });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });

        it('rejects update when cases.grupo_id is outside the IN list', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.grupo_id',
                        operator: RuleOperator.IN,
                        value: `${uuidv4()},${uuidv4()}`,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).rejects.toThrow(ValidationFailError);
        });

        it('allows update when cases.external_code is NOT_NULL', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.external_code',
                        operator: RuleOperator.NOT_NULL,
                        value: '',
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                external_code: 'EXT-001',
            });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });

        it('rejects update when cases.external_code is NOT_NULL but the case has null', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.external_code',
                        operator: RuleOperator.NOT_NULL,
                        value: '',
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                external_code: null,
            });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).rejects.toThrow(ValidationFailError);
        });

        it('allows update when an AND composite over cases.estadoActual + cases.clasificacion_id matches', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const destinoT2 = T2.siguiente_estado_id.value;
            const clasificacionId = uuidv4();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: destinoT2,
                        type: 'manual_input',
                    },
                    {
                        field: 'cases.clasificacion_id',
                        operator: RuleOperator.EQUALS,
                        value: clasificacionId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                clasificacion_id: clasificacionId,
            });

            await expect(
                makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, updated_at: new Date() })
            ).resolves.toEqual(EMPTY_WRITE_OUTCOME);
        });
    });

    describe('CaseTransitionsUpdater — cases entity filters (real getCasoInfo)', () => {
        useRealGetCasoInfo();

        function makeUpdater() {
            return new CaseTransitionsUpdater(
                repository,
                transitionsCaseRepo,
                actionExecutionServiceMock,
                currentUser,
                ruleRepo
            );
        }

        it('allows transition when cases.estadoActual matches the case current state (validated pre-update)', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const currentStateId = T1.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: currentStateId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
        });

        it('rejects transition when cases.estadoActual does not match', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value })).rejects.toThrow(
                ValidationFailError
            );

            const unchanged = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(unchanged.transicion_id).toBe(T1.id.value);
        });

        it('allows transition when cases.alto_impacto matches the persisted value', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.alto_impacto',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, {
                transicion_id: T1.id.value,
                alto_impacto: 1,
            });

            await makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
        });

        it('rejects transition when cases.cliente_id does not match', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const rule = await makeRule({
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.cliente_id',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await expect(makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value })).rejects.toThrow(
                ValidationFailError
            );
        });

        it('allows transition when an OR composite over cases.estadoActual matches the current state branch', async () => {
            const { T1, T2 } = await seedLinearFlow();
            const currentStateId = T1.siguiente_estado_id.value;
            const rule = await makeRule({
                combinator: 'or',
                rules: [
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: uuidv4(),
                        type: 'manual_input',
                    },
                    {
                        field: 'cases.estadoActual',
                        operator: RuleOperator.EQUALS,
                        value: currentStateId,
                        type: 'manual_input',
                    },
                ],
            });
            await attachRuleToTransition(T2.id.value, rule.id.value);

            const kase = await CasesMother.createCase(repository, { transicion_id: T1.id.value });

            await makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.transicion_id).toBe(T2.id.value);
        });
    });
});
