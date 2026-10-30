import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError, ValidationFailError } from '../../src/shared/index.js';
import HelpsMother from './domain/HelpsMother';
import {
    Helps,
    HelpsCollectionResponse,
    HelpsCreator,
    HelpsDeleter,
    HelpsFinder,
    KnexHelpsRepository,
    HelpsSearcher,
    HelpsUpdater,
} from '../../src/helps/index.js';

describe('Helps tests', () => {
    const repository = new KnexHelpsRepository(knexConfig);

    it('should create a new Help instance', async () => {
        const dto = HelpsMother.dto();
        const helpCreator = new HelpsCreator(repository);
        const createdHelp = await helpCreator.execute(dto);
        const result = await repository.connection('helps').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
        expect(createdHelp.id.value).toBe(result[0].id);
    });

    it('should return null if no Help record is found', async () => {
        await expect(new HelpsFinder(repository).execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should not update a Help instance if the title already exists', async () => {
        const help1 = await HelpsMother.createRandomHelps(repository);
        const help2 = await HelpsMother.createRandomHelps(repository);
        await expect(
            new HelpsUpdater(repository).execute(
                {
                    titulo: help2.titulo.value,
                },
                help1.id.value
            )
        ).rejects.toThrow(ValidationFailError);
    });

    it('should find an existing Help instance by id', async () => {
        const help = await HelpsMother.createHelp(repository);
        const helpFinder = new HelpsFinder(repository);

        const helpResponse = await helpFinder.execute(help.id.value);

        const helpJsonResponse = helpResponse.toJson().data;

        expect(helpJsonResponse.id).toBe(help.id.value);
    });

    it('should update an existing Help instance', async () => {
        const help = await HelpsMother.createHelp(repository);
        const helpUpdater = new HelpsUpdater(repository);

        const dtoUpdate = {
            descripcion: 'new description updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await helpUpdater.execute(dtoUpdate, help.id.value);

        const result = await repository.find(help.id);
        expect(result).toBeInstanceOf(Helps);
        expect(result.descripcion.value).toBe(dtoUpdate.descripcion);
    });

    it('should delete an existing Help instance by id', async () => {
        const help = await HelpsMother.createHelp(repository);
        const helpDeleter = new HelpsDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await helpDeleter.execute(help.id.value, deleteDto);

        await expect(new HelpsFinder(repository).execute(help.id.value)).rejects.toThrow(CustomError);
    });

    it('should search for Help instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await HelpsMother.createRandomHelps(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const helpSearcher = new HelpsSearcher(repository);

        const helpResult = await helpSearcher.execute(dtoCriteria);

        expect(helpResult).toBeInstanceOf(HelpsCollectionResponse);
    });
});
