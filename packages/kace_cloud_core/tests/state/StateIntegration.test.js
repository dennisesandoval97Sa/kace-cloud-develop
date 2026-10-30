import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import {
    KnexStateRepository,
    State,
    StateCollectionResponse,
    StateCounter,
    StateCreator,
    StateDeleter,
    StateFinder,
    StateResponse,
    StateSearcher,
    StateUpdater,
} from '../../src/state/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { StateMother } from './domain/StateMother.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import { ValidationFailError } from '../../src/shared/index.js';

describe('State Crud', () => {
    const repository = new KnexStateRepository(knexConfig);
    const transitionRepository = new KnexTransitionsRepository(repository.connection);

    it('creates a new State instance', async () => {
        const dto = StateMother.dto();
        const stateCreator = new StateCreator(repository);

        await stateCreator.execute(dto);

        const result = await repository.connection('estados').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should not create a new State instance when null dto', async () => {
        const stateCreator = new StateCreator(repository);

        await expect(stateCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing State instance by id', async () => {
        const state = await StateMother.createState(repository);
        const stateFinder = new StateFinder(repository);

        const stateResult = await stateFinder.execute(state.id.value);

        expect(stateResult).not.toBeNull();
        expect(stateResult).toBeInstanceOf(StateResponse);
    });

    it('throws an error if state not found', async () => {
        const stateFinder = new StateFinder(repository);

        await expect(stateFinder.execute(uuidv4())).rejects.toThrow('State not found');
    });

    it('updates an existing State instance with new name', async () => {
        const state = await StateMother.createState(repository);
        const stateUpdater = new StateUpdater(repository);

        await stateUpdater.execute(state.id.value, { nombre: 'new name' });

        const result = await repository.find(state.id);
        expect(result).toBeInstanceOf(State);
        expect(result.nombre.value).toBe('new name');
    });

    it('updates an existing State instance with all attributes', async () => {
        const state = await StateMother.createState(repository);
        const stateUpdater = new StateUpdater(repository);

        const stateRandom = StateMother.randomDto();
        const dto = {
            nombre: stateRandom.nombre,
            descripcion: stateRandom.descripcion,
            icon_class: stateRandom.icon_class,
            status: 2,
            color: stateRandom.color,
            require_observation: stateRandom.require_observation,
            updated_by: uuidv4(),
            updated_at: new Date().toISOString(),
        };

        await stateUpdater.execute(state.id.value, dto);

        const result = await repository.find(state.id);
        expect(result).toBeInstanceOf(State);
        expect(result.nombre.value).toBe(dto.nombre);
        expect(result.descripcion.value).toBe(dto.descripcion);
        expect(result.icon_class.value).toBe(dto.icon_class);
        expect(result.status.value).toBe(dto.status);
        expect(result.color.value).toBe(dto.color);
        expect(result.require_observation.value).toBe(dto.require_observation);
    });

    it('should return an error when update a non-existent State instance', async () => {
        await StateMother.createState(repository);
        const stateUpdater = new StateUpdater(repository);

        await expect(stateUpdater.execute(uuidv4(), { nombre: 'new name' })).rejects.toThrow(CustomError);
    });

    it('deletes an existing State instance by id', async () => {
        const state = await StateMother.createState(repository);
        const stateDeleter = new StateDeleter(repository, transitionRepository);

        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await stateDeleter.execute(state.id.value, deleteDto);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const stateSearch = new StateSearcher(repository);

        const stateResult = await stateSearch.execute(dtoCriteria);
        const stateResultJson = stateResult.toJson();

        // La semilla ya deja estados con `created_at` anterior, asi que el primer
        // elemento del listado no tiene por que ser el que acaba de borrarse.
        const deletedItem = stateResultJson.data.items.find((item) => item.id === state.id.value);

        expect(deletedItem.deleted_at).toBe(deleteDto.deleted_at);
        expect(deletedItem.deleted_by).toBe(deleteDto.deleted_by);
    });

    it('should return an error when delete a non-existent State instance', async () => {
        await StateMother.createState(repository);
        const stateDeleter = new StateDeleter(repository);

        await expect(stateDeleter.execute(uuidv4(), { nombre: 'new name' })).rejects.toThrow(CustomError);
    });

    it('should prevent deletion of state when it is used by transitions as source', async () => {
        const sourceState = await StateMother.createState(repository);

        await TransitionsMother.createTransition(transitionRepository, sourceState, null);

        const stateDeleter = new StateDeleter(repository, transitionRepository);
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(stateDeleter.execute(sourceState.id.value, deleteDto)).rejects.toThrow(
            new ValidationFailError('Cannot delete state. It is being used by 1 transition(s)')
        );
    });

    it('should prevent deletion of state when it is used by transitions as target', async () => {
        const targetState = await StateMother.createState(repository);

        await TransitionsMother.createTransition(transitionRepository, null, null, targetState);

        const stateDeleter = new StateDeleter(repository, transitionRepository);
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(stateDeleter.execute(targetState.id.value, deleteDto)).rejects.toThrow(
            new ValidationFailError('Cannot delete state. It is being used by 1 transition(s)')
        );
    });

    it('should prevent deletion of state when it is used by multiple transitions', async () => {
        const sourceState = await StateMother.createState(repository);
        const targetState1 = await StateMother.createState(repository);
        const targetState2 = await StateMother.createState(repository);

        await TransitionsMother.createTransition(transitionRepository, sourceState, null, targetState1);
        await TransitionsMother.createTransition(transitionRepository, sourceState, null, targetState2);

        const stateDeleter = new StateDeleter(repository, transitionRepository);
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(stateDeleter.execute(sourceState.id.value, deleteDto)).rejects.toThrow(
            new ValidationFailError('Cannot delete state. It is being used by 2 transition(s)')
        );
    });

    it('should allow deletion of state when it is not used by any transitions', async () => {
        const state = await StateMother.createState(repository);
        const otherState1 = await StateMother.createState(repository);
        const otherState2 = await StateMother.createState(repository);

        await TransitionsMother.createTransition(transitionRepository, otherState1, null, otherState2);

        const stateDeleter = new StateDeleter(repository, transitionRepository);
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(stateDeleter.execute(state.id.value, deleteDto)).resolves.not.toThrow();

        const deletedState = await repository.connection(repository.tableName).where({ id: state.id.value }).first();

        // `estados.deleted_at` es un timestamp: postgres lo devuelve como `Date`.
        expect(new Date(deletedState.deleted_at).toISOString()).toBe(deleteDto.deleted_at);
        expect(deletedState.deleted_by).toBe(deleteDto.deleted_by);
    });

    it('should allow deletion of state when all transitions using it are deleted', async () => {
        const sourceState = await StateMother.createState(repository);
        const targetState = await StateMother.createState(repository);

        const transition = await TransitionsMother.createTransition(
            transitionRepository,
            sourceState,
            null,
            targetState
        );
        transition.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });
        await transitionRepository.delete(transition);

        const stateDeleter = new StateDeleter(repository, transitionRepository);
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(stateDeleter.execute(sourceState.id.value, deleteDto)).resolves.not.toThrow();

        const deletedState = await repository
            .connection(repository.tableName)
            .where({ id: sourceState.id.value })
            .first();
        // `estados.deleted_at` es un timestamp: postgres lo devuelve como `Date`.
        expect(new Date(deletedState.deleted_at).toISOString()).toBe(deleteDto.deleted_at);
        expect(deletedState.deleted_by).toBe(deleteDto.deleted_by);
    });

    it('searches for State instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await StateMother.createRandomState(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const stateSearch = new StateSearcher(repository);

        const stateResult = await stateSearch.execute(dtoCriteria);
        const stateResultJson = stateResult.toJson();

        expect(stateResult).toBeInstanceOf(StateCollectionResponse);
        expect(stateResultJson.data.items.length).toBe(10);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await StateMother.createRandomState(repository);
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

        await expect(new StateSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of State instances', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const stateCounter = new StateCounter(repository);
        // La semilla deja estados por defecto en la tabla: se cuenta el incremento.
        const initialCount = Number((await stateCounter.execute(dtoCriteria)).count);

        for (let i = 0; i < 10; i++) {
            await StateMother.createRandomState(repository);
        }

        const stateResult = await stateCounter.execute(dtoCriteria);

        expect(Number(stateResult.count)).toBe(initialCount + 10);
    });

    it('should return a cero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await StateMother.createRandomState(repository);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'nombre',
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

        const stateCounter = new StateCounter(repository);

        const stateResult = await stateCounter.execute(dtoCriteria);

        expect(Number(stateResult.count)).toBe(0);
    });

    it('should throw an error when creating a State with duplicate fields', async () => {
        const dto1 = StateMother.dto();
        const dto2 = StateMother.dto();
        dto2.nombre = dto1.nombre;
        dto2.icon_class = dto1.icon_class;
        dto2.require_observation = dto1.require_observation;

        const stateCreator = new StateCreator(repository);
        await stateCreator.execute(dto1);
        await expect(stateCreator.execute(dto2)).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: nombre '${dto2.nombre}', icon_class '${dto2.icon_class}', require_observation '${dto2.require_observation}'.`
            )
        );
    });

    it('should throw an error when updating a State to have duplicate fields', async () => {
        const state1 = await StateMother.createState(repository);
        const state2 = await StateMother.createState(repository);

        const stateUpdater = new StateUpdater(repository);
        await expect(stateUpdater.execute(state2.id.value, { nombre: state1.nombre.value })).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: nombre '${state2.nombre.value}', icon_class '${state2.icon_class.value}', require_observation '${state2.require_observation.value}'.`
            )
        );
    });
});
