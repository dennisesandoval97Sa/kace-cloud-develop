import {
    Literal,
    LiteralCounter,
    LiteralCreator,
    LiteralDeleter,
    LiteralFinder,
    LiteralSearcher,
    LiteralUpdater,
    LiteralResponse,
    LiteralCollectionResponse,
    KnexLiteralRepository,
} from '../../src/literals';
import LiteralMother from './domain/LiteralMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';

describe('Literal Integration Tests', () => {
    const repository = new KnexLiteralRepository(knexConfig);

    it('should create a Literal', async () => {
        const dto = LiteralMother.dto();
        const literalCreator = new LiteralCreator(repository);

        await literalCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalFinder = new LiteralFinder(repository);

        const literalResult = await literalFinder.execute(literal.id.value);

        expect(literalResult).not.toBeNull();
        expect(literalResult).toBeInstanceOf(LiteralResponse);
    });

    it('can update an existing Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalUpdater = new LiteralUpdater(repository);

        const newValues = { is_active: false };
        await literalUpdater.execute(literal.id.value, newValues);

        const result = await repository.find(literal.id);
        expect(result).toBeInstanceOf(Literal);
        expect(result.is_active.value).toBe(newValues.is_active);
    });

    it('can delete an existing Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalDeleter = new LiteralDeleter(repository);

        await literalDeleter.execute(literal.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        const result = await repository.find(literal.id);
        expect(result).toBeInstanceOf(Literal);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for Literal instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await LiteralMother.createLiteral(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: 'true',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const literalSearcher = new LiteralSearcher(repository);

        const literalResult = await literalSearcher.execute(dtoCriteria);
        expect(literalResult).toBeInstanceOf(LiteralCollectionResponse);
    });

    it('searches for literals with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'nombre',
                    operator: 'eq',
                    value: uuidv4(),
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const literalSearcher = new LiteralSearcher(repository);

        const literalResult = await literalSearcher.execute(dtoCriteria);
        expect(literalResult).toBeInstanceOf(LiteralCollectionResponse);
        expect(literalResult.toJson().data.items.length).toBe(0);
    });

    it('Should throw an error when finding a non-existent Literal instance', async () => {
        const literalFinder = new LiteralFinder(repository);

        await expect(literalFinder.execute(uuidv4())).rejects.toThrow('Literal not found');
    });

    it('should throw an error when creating a Literal with invalid data', async () => {
        const invalidDto = LiteralMother.dto();
        delete invalidDto.id;
        const literalCreator = new LiteralCreator(repository);

        await expect(literalCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent Literal', async () => {
        const literalUpdater = new LiteralUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { nombre: 'Updated Name' };

        await expect(literalUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `Literal with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when deleting a non-existent Literal', async () => {
        const literalDeleter = new LiteralDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            literalDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(`Literal with ID ${nonExistentId} does not exist.`);
    });

    it('should throw an error when deleting a non-existent Literal', async () => {
        const literalDeleter = new LiteralDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            literalDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(`Literal with ID ${nonExistentId} does not exist.`);
    });

    it('should throw an error when create a non-existent LiteralType', async () => {
        const dto = LiteralMother.dto({ tipo_literal: uuidv4() });
        const literalCreator = new LiteralCreator(repository);

        await expect(literalCreator.execute(dto)).rejects.toThrow(Error);
    });

    it('should throw an error when create a non-existent Entity Literal', async () => {
        const dto = LiteralMother.dto({ nombre: 'Non-existent Entity Literal' });
        const literalCreator = new LiteralCreator(repository);

        await expect(literalCreator.execute(dto)).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw an error when update a non-existent LiteralType', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalUpdater = new LiteralUpdater(repository);

        const newValues = { tipo_literal: uuidv4() };

        await expect(literalUpdater.execute(literal.id.value, newValues)).rejects.toThrow(Error);
    });

    it('should throw an error when update a non-existent Entity Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalUpdater = new LiteralUpdater(repository);

        const newValues = { nombre: 'Non-existent Entity Literal' };

        await expect(literalUpdater.execute(literal.id.value, newValues)).rejects.toThrow(InvalidArgumentError);
    });

    it('should count Literals correctly', async () => {
        const counter = new LiteralCounter(repository);
        const countBefore = await counter.execute({ filter: [], relationship: null });
        const totalBefore = Number(countBefore.count);

        for (let i = 0; i < 10; i++) {
            await LiteralMother.createLiteral(repository);
        }

        const countAfter = await counter.execute({ filter: [], relationship: null });
        const totalAfter = Number(countAfter.count);
        expect(totalAfter - totalBefore).toBe(10);
    });

    it('should throw an error when creating a Literal with a non-unique name', async () => {
        await LiteralMother.createLiteral(repository);

        const duplicateLiteralDto = LiteralMother.dto();
        const literalCreator = new LiteralCreator(repository);
        await expect(literalCreator.execute(duplicateLiteralDto)).rejects.toThrow(
            new InvalidArgumentError('A Literal with the name "literales" already exists.')
        );
    });

    it('should throw an error when updating a Literal with a non-unique name', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literal2 = await LiteralMother.createLiteral(repository, { nombre: 'ans' });
        const literalUpdater = new LiteralUpdater(repository);

        const newValues = { nombre: literal.nombre.value };

        await expect(literalUpdater.execute(literal2.id.value, newValues)).rejects.toThrow(
            new InvalidArgumentError(`A Literal with the name "${literal.nombre.value}" already exists.`)
        );
    });

    it('should throw an error when creating a Literal with the same name and type_literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalUnique = { nombre: 'Unique Name', tipo_literal: literal.id.value };
        await LiteralMother.createLiteral(repository, LiteralMother.dto(literalUnique));

        const literalCreator = new LiteralCreator(repository);

        await expect(literalCreator.execute(LiteralMother.dto(literalUnique))).rejects.toThrow(
            new InvalidArgumentError(
                'A Literal with the name "Unique Name" for the selected literal type already exists'
            )
        );
    });

    it('should throw an error when updating a Literal with a name that already exists for the selected literal type', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const literalUnique = { nombre: 'Unique Name', tipo_literal: literal.id.value };
        await LiteralMother.createLiteral(repository, LiteralMother.dto(literalUnique));

        const literalForUpdate = await LiteralMother.createLiteral(
            repository,
            LiteralMother.dto({ nombre: 'Unique Name Update', tipo_literal: literal.id.value })
        );

        const literalUpdater = new LiteralUpdater(repository);
        await expect(
            literalUpdater.execute(literalForUpdate.id.value, LiteralMother.dto(literalUnique))
        ).rejects.toThrow(
            new InvalidArgumentError(
                'A Literal with the name "Unique Name" for the selected literal type already exists'
            )
        );
    });
});
