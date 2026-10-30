/**
 * Unit-level tests for context builders in KnexCaseRepository.
 *
 * These exercise the REAL builders (no mocks) against SQLite in-memory and lock in the
 * shared `estados: { id, nombre }` contract used by TransitionRuleValidator:
 *  - buildCaseContextFromDto  (used by validateFromDto at case creation)
 *  - getCasoInfo              (used by validateFromCase at update / transition change)
 *  - getCaseContextById       (used by enforceRuleForTransitionWithMergedContext)
 */
import { v4 as uuidv4 } from 'uuid';

import { knexConfig } from '../../../knexfile.js';
import { KnexCaseRepository } from '../../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { KnexStateRepository } from '../../../../src/state/index.js';
import { KnexFlowRepository } from '../../../../src/flow/index.js';
import { KnexTransitionsRepository } from '../../../../src/transition/index.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { StateMother } from '../../../state/domain/StateMother.js';
import FlowsMother from '../../../flow/domain/FlowsMother.js';
import { TransitionsMother } from '../../../transition/domain/TransitionsMother.js';

describe('KnexCaseRepository — context builders (estados contract)', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const stateRepo = new KnexStateRepository(repository.connection);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);

    async function seedTransition() {
        const source = await StateMother.createState(stateRepo, { nombre: 'Source' });
        const target = await StateMother.createState(stateRepo, { nombre: 'Target' });
        const flow = await FlowsMother.createFlow(flowRepo);
        const transition = await TransitionsMother.createTransition(transitionRepo, source, flow, target);
        return { source, target, flow, transition };
    }

    describe('buildCaseContextFromDto', () => {
        it('populates estados { id, nombre } from the transition destination state', async () => {
            const { target, transition } = await seedTransition();
            const dto = CasesMother.dto({ transicion_id: transition.id.value });

            const context = await repository.buildCaseContextFromDto(dto);

            expect(context.estados).toEqual({ id: target.id.value, nombre: target.nombre.value });
        });

        it('returns estados with undefined id/nombre when dto has no transicion_id', async () => {
            const dto = CasesMother.dto({ transicion_id: null });

            const context = await repository.buildCaseContextFromDto(dto);

            expect(context.estados).toEqual({ id: undefined, nombre: undefined });
        });

        it('returns estados with undefined id/nombre when transicion_id does not exist', async () => {
            const dto = CasesMother.dto({ transicion_id: uuidv4() });

            const context = await repository.buildCaseContextFromDto(dto);

            expect(context.estados).toEqual({ id: undefined, nombre: undefined });
        });

        it('returns the rest of the expected context shape', async () => {
            const { transition } = await seedTransition();
            const dto = CasesMother.dto({ transicion_id: transition.id.value });

            const context = await repository.buildCaseContextFromDto(dto);

            expect(context).toEqual(
                expect.objectContaining({
                    cases: expect.objectContaining({ transicion_id: transition.id.value }),
                    clients: expect.any(Object),
                    clasificaciones: expect.any(Object),
                    aux_cases: expect.any(Object),
                    aux_clients: expect.any(Object),
                    estados: expect.any(Object),
                })
            );
        });
    });

    describe('getCaseContextById', () => {
        it('populates estados { id, nombre } from the persisted case transition', async () => {
            const { target, transition } = await seedTransition();
            const kase = await CasesMother.createCase(repository, { transicion_id: transition.id.value });

            const context = await repository.getCaseContextById(kase.id);

            expect(context.estados).toEqual({ id: target.id.value, nombre: target.nombre.value });
        });

        it('returns null when the case does not exist', async () => {
            const context = await repository.getCaseContextById({ value: uuidv4() });
            expect(context).toBeNull();
        });
    });
});
