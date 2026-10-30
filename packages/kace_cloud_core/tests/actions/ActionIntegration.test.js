import {
    Action,
    ActionCollectionResponse,
    ActionCounter,
    ActionCreator,
    ActionDeleter,
    ActionFinder,
    ActionResponse,
    ActionSearcher,
    ActionUpdater,
    KnexActionRepository,
} from '../../src/actions/index.js';
import ActionMother from './domain/ActionMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { SchemasMother } from '../schemas/domain/SchemasMother.js';
import { SchemaCreator } from '../../src/schemas/application/create/SchemaCreator.js';
import { AuxDefinitionsMother } from '../aux_definitions/domain/AuxDefinitionsMother.js';
import { AuxDefinitionCreator } from '../../src/aux_definitions/application/create/AuxDefinitionCreator.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { KnexAuxDefinitionsRepository } from '../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { AuxDefinitionUpdater } from '../../src/aux_definitions/application/update/AuxDefinitionUpdater.js';
import { KnexWSRestFlowRepository, WSRestFlowCreator } from '../../src/ws-rest-flows/index.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import { SchemaRules } from '../../src/schemas/application/rules/SchemaRules.js';
import { User } from '../../src/users/index.js';

describe('Action Integration Tests', () => {
    const repository = new KnexActionRepository(knexConfig);
    const schemaRepository = new KnexSchemasRepository(repository.connection);
    const auxDefinitionRepository = new KnexAuxDefinitionsRepository(repository.connection);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(repository.connection);
    const highPrivilegesRepository = new KnexAuxDefinitionsRepository(repository.connection);
    const schemaRules = new SchemaRules(schemaRepository);
    const currentUser = new User(UsersMother.dto());

    it('should create an Action', async () => {
        const dto = ActionMother.dto();
        const actionCreator = new ActionCreator(repository, schemaRules);

        await actionCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing Action', async () => {
        const action = await ActionMother.create(repository);
        const actionFinder = new ActionFinder(repository, currentUser);

        const actionResult = await actionFinder.execute(action.id.value);

        expect(actionResult).not.toBeNull();
        expect(actionResult).toBeInstanceOf(ActionResponse);
    });

    it('can update an existing Action', async () => {
        const action = await ActionMother.create(repository);
        const actionUpdater = new ActionUpdater(repository, schemaRules);

        const newValues = { description: 'Updated action description' };
        await actionUpdater.execute(action.id.value, newValues);

        const result = await repository.find(action.id);
        expect(result).toBeInstanceOf(Action);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can update an existing Action without touching the description (skips the uniqueness check)', async () => {
        const action = await ActionMother.create(repository);
        const actionUpdater = new ActionUpdater(repository, schemaRules);

        const newValues = { priority: 42 };
        await actionUpdater.execute(action.id.value, newValues);

        const result = await repository.find(action.id);
        expect(result.priority.value).toBe(newValues.priority);
        expect(result.description.value).toBe(action.description.value);
    });

    it('should throw when updating an Action to a description that already belongs to another Action', async () => {
        const other = await ActionMother.create(repository);
        const action = await ActionMother.create(repository);
        const actionUpdater = new ActionUpdater(repository, schemaRules);

        await expect(actionUpdater.execute(action.id.value, { description: other.description.value })).rejects.toThrow(
            ValidationFailError
        );

        const result = await repository.find(action.id);
        expect(result.description.value).toBe(action.description.value);
    });

    it('documents a bug: updating an Action with an invalid dynamic code path throws a ReferenceError instead of CustomError', async () => {
        // BUG (ActionUpdater.js:70): `throw new CustomError('Dynamic code path not exist')`
        // references `CustomError`, which — unlike the near-identical check in
        // ActionCreator.js — is never imported in this file. Instead of the intended
        // `CustomError`, this throws `ReferenceError: CustomError is not defined`.
        // Documented, not fixed: production code changes are out of scope here.
        // `ActionMother.dto()` applies `responsible_id ?? uuidV4()`, so overriding it to
        // `null` through `ActionMother.create`'s own `data` param is silently replaced by a
        // fresh uuid (same "??` treats null as not provided" pitfall as elsewhere in these
        // mothers). Building the dto first and overriding `responsible_id` on the *returned*
        // object bypasses that.
        const dto = {
            ...ActionMother.dto({ action_type: 'asignar_grupo_por_codigo_externo_dinamico' }),
            responsible_id: null,
        };
        const action = Action.create(dto);
        await repository.save(action);
        const actionUpdater = new ActionUpdater(repository, schemaRules);

        // No `aux_cases` schema is configured at all here, so `getAuxCasesSchemaId()`
        // resolves to null/undefined and `isValidPath` never even gets a chance to be
        // computed from a real schema — this covers that "no schema configured" branch,
        // distinct from "schema configured but path invalid" below.
        await repository.connection('aux_definitions').where({ tablename: 'aux_cases' }).update({
            deleted_at: new Date().toISOString(),
        });

        await expect(
            actionUpdater.execute(action.id.value, {
                external_group_dynamic_code: 'no_schema_configured',
            })
        ).rejects.toThrow('CustomError is not defined');
    });

    it('can update an Action with a valid dynamic code path once the aux_cases schema resolves it', async () => {
        // El seed `20250701000002_seed_aux_definitions` ya trae una fila con
        // tablename='aux_cases'; se retira (borrado logico) para que gane la del test,
        // igual que en 'should create an Action with an correct auxiliary route'.
        await repository.connection('aux_definitions').where({ tablename: 'aux_cases' }).update({
            deleted_at: new Date().toISOString(),
        });

        const schemaDto = SchemasMother.dto();
        const schemaCreator = new SchemaCreator(schemaRepository);
        await schemaCreator.execute(schemaDto);

        const restFlowDto = WSRestFlowMother.dto();
        const restFlowCreator = new WSRestFlowCreator(wsRestFlowRepository);
        await restFlowCreator.execute(restFlowDto);

        const auxDefinitionDto = AuxDefinitionsMother.dto({
            name: 'test_updater',
            tablename: 'aux_test_updater',
            logs_tablename: 'history_aux_test_updater',
            schema_id: schemaDto.id,
            restflow_id: restFlowDto.id,
        });
        const auxDefinitionCreator = new AuxDefinitionCreator(
            auxDefinitionRepository,
            schemaRepository,
            wsRestFlowRepository,
            highPrivilegesRepository
        );
        await auxDefinitionCreator.execute(auxDefinitionDto);

        const auxDefinitionNewDto = { name: 'cases', tablename: 'aux_cases', logs_tablename: 'history_aux_cases' };
        const auxDefinitionUpdater = new AuxDefinitionUpdater(auxDefinitionRepository);
        await auxDefinitionUpdater.execute(auxDefinitionNewDto, auxDefinitionDto.id);

        const dto = {
            ...ActionMother.dto({ action_type: 'asignar_grupo_por_codigo_externo_dinamico' }),
            responsible_id: null,
        };
        const action = Action.create(dto);
        await repository.save(action);
        const actionUpdater = new ActionUpdater(repository, schemaRules);

        await actionUpdater.execute(action.id.value, {
            external_group_dynamic_code: 'campo1',
        });

        const result = await repository.find(action.id);
        expect(result.external_group_dynamic_code.value).toBe('campo1');
    });

    it('can delete an existing Action', async () => {
        const action = await ActionMother.create(repository);
        const actionDeleter = new ActionDeleter(repository);

        await actionDeleter.execute(action.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(action.id);
        expect(result).toBeInstanceOf(Action);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for Actions with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const actionSearcher = new ActionSearcher(repository);

        const searchResult = await actionSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(ActionCollectionResponse);
    });

    it('should throw an error when creating an existing Action', async () => {
        const action = await ActionMother.create(repository);
        const actionCreator = new ActionCreator(repository, schemaRules);

        const dto = { ...ActionMother.dto(), id: action.id.value };
        await expect(actionCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Action with id ${dto.id} already exists`)
        );
    });

    it('should return an error when trying to find an Action with a non-existent ID', async () => {
        const actionFinder = new ActionFinder(repository);

        await expect(actionFinder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating an Action with invalid data', async () => {
        const dto = ActionMother.dto();
        delete dto.id;
        const actionCreator = new ActionCreator(repository, schemaRules);

        await expect(actionCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when dto is null or undefined', async () => {
        const actionCreator = new ActionCreator(repository, schemaRules);

        await expect(actionCreator.execute(null)).rejects.toThrow('dto cannot be null or undefined');
        await expect(actionCreator.execute(undefined)).rejects.toThrow('dto cannot be null or undefined');
    });

    it('should throw CustomError for a dynamic code path when no aux_cases schema is configured at all', async () => {
        // Distinct from 'should throw an error when trying to create an Action with an
        // incorrect auxiliary route' above: that one relies on a real (but mismatched)
        // schema, exercising `if (schemaId)` true with `isValidPath` false. This removes
        // the aux_cases mapping entirely, exercising the `schemaId` falsy branch instead.
        await repository.connection('aux_definitions').where({ tablename: 'aux_cases' }).update({
            deleted_at: new Date().toISOString(),
        });

        const actionDto = ActionMother.dto();
        const actionCreator = new ActionCreator(repository, schemaRules);

        await expect(
            actionCreator.execute({
                ...actionDto,
                responsible_id: null,
                action_type: 'asignar_grupo_por_codigo_externo_dinamico',
                external_group_dynamic_code: 'no_schema_configured',
            })
        ).rejects.toThrow(new CustomError('Dynamic code path not exist'));
    });

    it('should throw an error when trying to update a non-existent Action', async () => {
        const actionUpdater = new ActionUpdater(repository, schemaRules);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(actionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `Action with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when trying to update an Action with an existing description', async () => {
        const actionDto1 = ActionMother.dto();
        const actionDto2 = ActionMother.dto();
        const actionCreator = new ActionCreator(repository, schemaRules);

        await actionCreator.execute(actionDto1);

        await expect(actionCreator.execute({ ...actionDto2, description: actionDto1.description })).rejects.toThrow(
            ValidationFailError
        );
    });

    it('should not throw an error when deleting a non-existent Action', async () => {
        const actionDeleter = new ActionDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            actionDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toThrow(`Action with ID ${nonExistentId} does not exist.`);
    });

    it('should count Action instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionMother.create(repository);
        }
        const counter = new ActionCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should throw an error when trying to create an Action with an incorrect auxiliary route', async () => {
        const actionDto = ActionMother.dto();
        const actionCreator = new ActionCreator(repository, schemaRules);

        await expect(
            actionCreator.execute({
                ...actionDto,
                responsible_id: null,
                action_type: 'asignar_grupo_por_codigo_externo_dinamico',
                external_group_dynamic_code: 'test',
            })
        ).rejects.toThrow(new CustomError('Dynamic code path not exist'));
    });

    it('should create an Action with an correct auxiliary route', async () => {
        // El seed `20250701000002_seed_aux_definitions` ya trae una fila con
        // tablename='aux_cases', y `getAuxCasesSchemaId` resuelve la suya con un
        // `limit(1)` sin ordenar: se quedaba con el esquema sembrado -cuyo
        // data_structure es `{ field: ... }`- en vez de con el que crea el test, y
        // 'campo1' salia como ruta inexistente. Se retira la sembrada (borrado
        // logico, que es lo que filtra la consulta) para que gane la del test.
        await repository.connection('aux_definitions').where({ tablename: 'aux_cases' }).update({
            deleted_at: new Date().toISOString(),
        });

        const schemaDto = SchemasMother.dto();
        const schemaCreator = new SchemaCreator(schemaRepository);
        await schemaCreator.execute(schemaDto);

        const restFlowDto = WSRestFlowMother.dto();
        const restFlowCreator = new WSRestFlowCreator(wsRestFlowRepository);
        await restFlowCreator.execute(restFlowDto);

        const auxDefinitionDto = AuxDefinitionsMother.dto({
            name: 'test',
            tablename: 'aux_test',
            logs_tablename: 'history_aux_test',
            schema_id: schemaDto.id,
            restflow_id: restFlowDto.id,
        });
        const auxDefinitionCreator = new AuxDefinitionCreator(
            auxDefinitionRepository,
            schemaRepository,
            wsRestFlowRepository,
            highPrivilegesRepository
        );
        await auxDefinitionCreator.execute(auxDefinitionDto);

        const auxDefinitionNewDto = { name: 'cases', tablename: 'aux_cases', logs_tablename: 'history_aux_cases' };
        const auxDefinitionUpdater = new AuxDefinitionUpdater(auxDefinitionRepository);
        await auxDefinitionUpdater.execute(auxDefinitionNewDto, auxDefinitionDto.id);

        const actionDto = ActionMother.dto();
        const actionCreator = new ActionCreator(repository, schemaRules);
        await actionCreator.execute({
            ...actionDto,
            responsible_id: null,
            action_type: 'asignar_grupo_por_codigo_externo_dinamico',
            external_group_dynamic_code: 'campo1',
        });

        const result = await repository.connection(repository.tableName).select('*').where('id', actionDto.id);
        expect(result.length).toBe(1);
    });

    it('should create an Action with entity value', async () => {
        const dto = ActionMother.dto({ entity: 'case' });
        const actionCreator = new ActionCreator(repository, schemaRules);

        await actionCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result[0].entity).toBe(dto.entity);
    });
});
