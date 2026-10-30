import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError';
import OneScriptMother from './domain/OneScriptMother.js';
import {
    KnexOneScriptRepository,
    OneScriptCreator,
    OneScriptUpdater,
    OneScript,
    OneScriptFinder,
    OneScriptResponse,
    OneScriptDeleter,
    OneScriptSearcher,
    OneScriptCollectionResponse,
} from '../../src/one-script';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { SchemasMother } from '../schemas/domain/SchemasMother.js';

describe('OneScript Integrations Tests', () => {
    const oneScriptRepository = new KnexOneScriptRepository(knexConfig);
    const schemaRepository = new KnexSchemasRepository(oneScriptRepository.connection);

    it('Should create a new oneScript instance', async () => {
        const dto = OneScriptMother.dto({ schema_id: null });
        const oneScriptCreator = new OneScriptCreator(oneScriptRepository);
        await oneScriptCreator.execute(dto);

        const response = await oneScriptRepository.connection('one-script').select('*').where('id', dto.id);
        expect(response.length).toBe(1);
    });

    it('Should get an existing oneScript instance by id', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const oneScriptFinder = new OneScriptFinder(oneScriptRepository);

        const oneScriptResult = await oneScriptFinder.execute(oneScript.id.value);

        expect(oneScriptResult).not.toBeNull();
        expect(oneScriptResult).toBeInstanceOf(OneScriptResponse);
    });

    it('Should update an existing oneScript instance', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const oneScriptUpdater = new OneScriptUpdater(oneScriptRepository);

        const dtoUpdate = {
            name: 'name updated',
            url_api: 'https://api.updated.com',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await oneScriptUpdater.execute(oneScript.id.value, dtoUpdate);
        const result = await oneScriptRepository.find(oneScript.id);

        expect(result).toBeInstanceOf(OneScript);
        expect(result.name.value).toBe(dtoUpdate.name);
        expect(result.url_api.value).toBe(dtoUpdate.url_api);
    });

    it('Should delete an existing OneScript instance by id', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const oneScriptDeleter = new OneScriptDeleter(oneScriptRepository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await oneScriptDeleter.execute(oneScript.id.value, deleteDto);

        const oneScriptFinder = await oneScriptRepository.find(oneScript.id);

        expect(oneScriptFinder.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(oneScriptFinder.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('Should throw an error when finding a non-existent oneScript instance', async () => {
        const id = 'fd7ca564-88a1-4034-bb77-601a09a59aa7';

        await expect(oneScriptRepository.find(id)).rejects.toThrow(QueryDBError);
    });

    it('Should find an OneScript instance with given criteria', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'name',
                    operator: 'eq',
                    value: oneScript.name.value,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const oneScriptSearcher = new OneScriptSearcher(oneScriptRepository);

        const searchResult = await oneScriptSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(OneScriptCollectionResponse);
    });

    it('Should throw an error when creating an existing OneScript instance', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const oneScriptCreator = new OneScriptCreator(oneScriptRepository, schemaRepository);

        const dto = { ...OneScriptMother.dto(), id: oneScript.id.value };
        await expect(oneScriptCreator.execute(dto)).rejects.toThrow(CustomError);
    });

    it('Should throw an error if schema_id does not exist or is not active', async () => {
        const fakeSchemaId = uuidv4();
        const dto = OneScriptMother.dto({ schema_id: fakeSchemaId });

        const oneScriptCreator = new OneScriptCreator(oneScriptRepository, schemaRepository);

        await expect(oneScriptCreator.execute(dto)).rejects.toThrow(CustomError);
    });

    it('Should create oneScript with valid schema_id', async () => {
        const schema = await SchemasMother.create({ id: uuidv4() }, schemaRepository);

        const dto = OneScriptMother.dto({ schema_id: schema.id.value });

        const oneScriptCreator = new OneScriptCreator(oneScriptRepository, schemaRepository);

        await oneScriptCreator.execute(dto);

        const saved = await oneScriptRepository.find({ value: dto.id });

        expect(saved.schema_id.value).toBe(schema.id.value);
    });
});
