import { v4 as uuidv4 } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { StatusEnum } from '../../src/shared';
import { CustomError } from '../../src/shared/errors/CustomError';
import { TransitionsMother } from './domain/TransitionsMother';
import UsersMother from '../users/domain/UsersMother.js';
import {
    TransitionsCollectionResponse,
    TransitionSearcher,
    TransitionUpdater,
    TransitionCreator,
    TransitionFinder,
    TransitionsFinderByState,
    TransitionsResponse,
    KnexTransitionsRepository,
    Transitions,
    TransitionsCounter,
} from '../../src/transition';
import FlowsMother from '../flow/domain/FlowsMother';
import { StateMother } from '../state/domain/StateMother';
import { KnexFlowRepository } from '../../src/flow';
import { KnexStateRepository } from '../../src/state';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { KnexUsersRepository } from '../../src/users/index.js';

describe('Transitions Test', () => {
    const repository = new KnexTransitionsRepository(knexConfig);
    const flowRepository = new KnexFlowRepository(knexConfig);
    const stateRepository = new KnexStateRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);

    it('creates a new Transiton instance', async () => {
        const dto = TransitionsMother.dto();
        await TransitionsMother.ensureRelations(repository.connection, dto, {});
        const transitionCreator = new TransitionCreator(repository);

        await transitionCreator.execute(dto);

        const result = await repository.connection('transiciones').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should not create a new Transitions instance when null dto', async () => {
        const transitionCreator = new TransitionCreator(repository);

        await expect(transitionCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Transition instance by id', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        const transition = await TransitionsMother.createTransition(repository, state, flow, nextState);
        const transitionFinder = new TransitionFinder(repository);

        const transitions = await transitionFinder.execute(transition.id.value);

        expect(transitions).not.toBeNull();
        expect(transitions).toBeInstanceOf(TransitionsResponse);
    });

    it('return null if not found a record', async () => {
        const transitionFinder = new TransitionFinder(repository);

        const transitionResult = await transitionFinder.execute(uuidv4());

        expect(transitionResult).toBeNull();
    });

    it('updates an existing Transition instance', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        const transition = await TransitionsMother.createTransition(repository, state, flow, nextState);
        const transicionUpdater = new TransitionUpdater(repository);

        const dtoUpdate = {
            estado_actual_id: uuidv4(),
            siguiente_estado_id: uuidv4(),
            flujo_id: uuidv4(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        await TransitionsMother.ensureRelations(repository.connection, dtoUpdate, {});

        await transicionUpdater.execute(dtoUpdate, transition.id.value);

        const result = await repository.find(transition.id);

        expect(result).toBeInstanceOf(Transitions);
        expect(result.estado_actual_id.value).toEqual(dtoUpdate.estado_actual_id);
        expect(result.siguiente_estado_id.value).toEqual(dtoUpdate.siguiente_estado_id);
        expect(result.flujo_id.value).toEqual(dtoUpdate.flujo_id);
        expect(result.updated_at.value).toEqual(dtoUpdate.updated_at);
        expect(result.updated_by.value).toEqual(dtoUpdate.updated_by);
    });

    it('should return an error when update a non-existent Transitions instance', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        await TransitionsMother.createTransition(repository, state, flow, nextState);
        const transitionUpdater = new TransitionUpdater(repository);

        await expect(transitionUpdater.execute({ status: StatusEnum.ACTIVE.value }, uuidv4())).rejects.toThrow(
            CustomError
        );
    });

    it('searches for Transitions instances with given criteria', async () => {
        const user = await UsersMother.createUser(usersRepository);
        for (let i = 0; i < 10; i++) {
            await TransitionsMother.createRandomTransition(repository, { created_by: user.id.value });
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const transitionSearcher = new TransitionSearcher(repository);

        const transitionResult = await transitionSearcher.execute(dtoCriteria);

        expect(transitionResult).toBeInstanceOf(TransitionsCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await TransitionsMother.createRandomTransition(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new TransitionSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Transition instances', async () => {
        for (let i = 0; i < 10; i++) {
            await TransitionsMother.createRandomTransition(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const transitionCounter = new TransitionsCounter(repository);

        const transitionResult = await transitionCounter.execute(dtoCriteria);

        expect(Number(transitionResult.count)).toBe(10);
    });

    it('should return a zero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await TransitionsMother.createRandomTransition(repository);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '10',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const transitionCounter = new TransitionsCounter(repository);

        const transitionResult = await transitionCounter.execute(dtoCriteria);

        expect(Number(transitionResult.count)).toBe(0);
    });

    it('should find transitions by state id', async () => {
        const sourceState = await StateMother.createState(stateRepository);
        const targetState1 = await StateMother.createState(stateRepository);
        const targetState2 = await StateMother.createState(stateRepository);

        const transition1 = await TransitionsMother.createTransition(repository, sourceState, null, targetState1);
        const transition2 = await TransitionsMother.createTransition(repository, sourceState, null, targetState2);

        const transition3 = await TransitionsMother.createTransition(repository, targetState1, null, sourceState);

        const transitionsFinderByState = new TransitionsFinderByState(repository);
        const foundTransitions = await transitionsFinderByState.execute(sourceState.id.value);

        expect(foundTransitions).toHaveLength(3);
        expect(foundTransitions.some((t) => t.id.value === transition1.id.value)).toBe(true);
        expect(foundTransitions.some((t) => t.id.value === transition2.id.value)).toBe(true);
        expect(foundTransitions.some((t) => t.id.value === transition3.id.value)).toBe(true);
    });

    it('should return empty array when no transitions use the state', async () => {
        const state = await StateMother.createState(stateRepository);
        const otherState1 = await StateMother.createState(stateRepository);
        const otherState2 = await StateMother.createState(stateRepository);

        await TransitionsMother.createTransition(repository, otherState1, null, otherState2);

        const transitionsFinderByState = new TransitionsFinderByState(repository);
        const foundTransitions = await transitionsFinderByState.execute(state.id.value);

        expect(foundTransitions).toHaveLength(0);
    });

    it('should not throw an error when try to create a transitions that already exists', async () => {
        // `rule_id: null` explicito: si la clave falta, `TransitionCreator` propaga
        // `undefined` al update y knex rechaza la consulta con "Empty .update()".
        const dto = TransitionsMother.dto({ rule_id: null });
        await TransitionsMother.ensureRelations(repository.connection, dto, {});
        const transitionCreator = new TransitionCreator(repository);
        await transitionCreator.execute(dto);

        // El matcher anterior (`expect(async () => ...).not.toThrow()`) recibia una
        // promesa, no veia excepcion sincrona y daba el test por bueno sin esperar
        // nada; ademas dejaba la segunda escritura suelta contra el test siguiente.
        await expect(
            transitionCreator.execute({ ...dto, updated_at: new Date().toISOString(), updated_by: uuidv4() })
        ).resolves.toBeUndefined();
    });

    it('creates a new Transiton instance with ans_id', async () => {
        const dto = TransitionsMother.dto();
        await TransitionsMother.ensureRelations(repository.connection, dto, {});
        const transitionCreator = new TransitionCreator(repository);

        await transitionCreator.execute(dto);

        const result = await repository.connection('transiciones').select('*').where('id', dto.id);

        expect(result[0].ans_id).toBe(dto.ans_id);
    });
});
