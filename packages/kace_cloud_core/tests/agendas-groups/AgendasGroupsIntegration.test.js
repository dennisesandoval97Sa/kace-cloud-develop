import { AgendasGroupsBatchCreator } from '../../src/agendas-groups/application/batch/AgendasGroupsBatchCreator.js';
import { AgendasGroupsBatchDeleter } from '../../src/agendas-groups/application/batch/AgendasGroupsBatchDeleter.js';
import { AgendasGroupsCreator } from '../../src/agendas-groups/application/create/AgendasGroupsCreator.js';
import { AgendasGroupsDeleter } from '../../src/agendas-groups/application/delete/AgendasGroupsDeleter.js';
import { AgendasGroupsSearcher } from '../../src/agendas-groups/application/search/AgendasGroupsSearcher.js';
import { AgendasGroupsFinder } from '../../src/agendas-groups/domain/AgendasGroupsFinder.js';
import { KnexAgendasGroupsRepository } from '../../src/agendas-groups/infrastructure/persistence/KnexAgendasGroupsRepository';
import { CustomError, UuidError, ValidationFailError } from '../../src/shared/index.js';
import { knexConfig } from '../knexfile.js';
import { AgendasGroupsMother } from './domain/AgendasGroupsMother.js';

describe('AgendasGroups Integration Test', () => {
    const agendasGroupsRepository = new KnexAgendasGroupsRepository(knexConfig);

    it('Should create an agenda group', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto();
        // El dto va al caso de uso sin pasar por `AgendasGroupsMother.create`,
        // que es quien normalmente respalda la agenda y el grupo.
        await AgendasGroupsMother.ensureRelations(agendasGroupsRepository.connection, agendasGroupsDto);
        const agendasGroupsCreator = new AgendasGroupsCreator(agendasGroupsRepository);

        await agendasGroupsCreator.execute(agendasGroupsDto);

        const agendasGroups = await agendasGroupsRepository
            .connection('agendas_groups')
            .where({ agenda_id: agendasGroupsDto.agenda_id, group_id: agendasGroupsDto.group_id })
            .first();

        expect(agendasGroups.id).toEqual(agendasGroupsDto.id);
    });

    it('Should throw an error when trying to create an agenda group that already exists', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto();
        await AgendasGroupsMother.ensureRelations(agendasGroupsRepository.connection, agendasGroupsDto);
        const agendasGroupsCreator = new AgendasGroupsCreator(agendasGroupsRepository);

        await agendasGroupsCreator.execute(agendasGroupsDto);

        await expect(agendasGroupsCreator.execute(agendasGroupsDto)).rejects.toThrow(ValidationFailError);
    });

    it('Should throw an error when trying to create an agenda group with an invalid agenda id', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto({ agenda_id: 'invalid_id' });
        const agendasGroupsCreator = new AgendasGroupsCreator(agendasGroupsRepository);

        await expect(agendasGroupsCreator.execute(agendasGroupsDto)).rejects.toThrow(UuidError);
    });

    it('Should throw an error when trying to create an agenda group with an invalid group id', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto({ group_id: 'invalid_id' });
        const agendasGroupsCreator = new AgendasGroupsCreator(agendasGroupsRepository);

        await expect(agendasGroupsCreator.execute(agendasGroupsDto)).rejects.toThrow(UuidError);
    });

    it('Should throw an error when trying to create an agenda group with an invalid agenda and group id', async () => {
        const agendasGroupsDto = AgendasGroupsMother.dto({ agenda_id: 'invalid_id', group_id: 'invalid_id' });
        const agendasGroupsCreator = new AgendasGroupsCreator(agendasGroupsRepository);

        await expect(agendasGroupsCreator.execute(agendasGroupsDto)).rejects.toThrow(UuidError);
    });

    it('should find an agenda group', async () => {
        const agendasGroups = await AgendasGroupsMother.create(agendasGroupsRepository);

        const agendasGroupsFinder = new AgendasGroupsFinder(agendasGroupsRepository);
        const agendasGroupsResponse = await agendasGroupsFinder.execute(
            agendasGroups.agenda_id.value,
            agendasGroups.group_id.value
        );

        expect(agendasGroupsResponse.agenda_id.value).toEqual(agendasGroups.agenda_id.value);
    });

    it('should throw an error when trying to find an agenda group that does not exist', async () => {
        const agendasGroupsFinder = new AgendasGroupsFinder(agendasGroupsRepository);
        await expect(agendasGroupsFinder.execute('invalid_id', 'invalid_id')).rejects.toThrow(UuidError);
    });

    it('should delete an agenda group', async () => {
        const agendaGroupsDto = AgendasGroupsMother.dto();
        const agendasGroups = await AgendasGroupsMother.create(agendasGroupsRepository, agendaGroupsDto);

        expect(agendasGroups).not.toBeNull();

        const agendasGroupsDeleter = new AgendasGroupsDeleter(agendasGroupsRepository);
        await agendasGroupsDeleter.execute(agendaGroupsDto);

        const deletedAgendasGroups = await agendasGroupsRepository
            .connection('agendas_groups')
            .where({ agenda_id: agendasGroups.agenda_id.value, group_id: agendasGroups.group_id.value })
            .first();

        expect(deletedAgendasGroups).toBeUndefined();
    });

    it('should throw an error when trying to delete an agenda group that does not exist', async () => {
        const agendasGroupsDeleter = new AgendasGroupsDeleter(agendasGroupsRepository);
        await expect(agendasGroupsDeleter.execute({ agenda_id: 'invalid_id', group_id: 'invalid_id' })).rejects.toThrow(
            UuidError
        );
    });

    it('should search for an agenda group with criteria', async () => {
        for (let i = 0; i < 3; i++) {
            await AgendasGroupsMother.create(agendasGroupsRepository);
        }

        const agendasGroupsFinder = new AgendasGroupsSearcher(agendasGroupsRepository);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 1,
            offset: 0,
            order: undefined,
        };

        const agendasGroupsCollectionResponse = await agendasGroupsFinder.execute(dtoCriteria);

        expect(agendasGroupsCollectionResponse.toJson().data.items.length).toBe(1);
    });

    it('should create a batch of agenda groups', async () => {
        const agendasGroupsDtos = [];

        for (let i = 0; i < 3; i++) {
            agendasGroupsDtos.push(AgendasGroupsMother.dto());
        }

        for (const dto of agendasGroupsDtos) {
            await AgendasGroupsMother.ensureRelations(agendasGroupsRepository.connection, dto);
        }

        const agendasGroupsBatchCreator = new AgendasGroupsBatchCreator(agendasGroupsRepository);
        await agendasGroupsBatchCreator.execute(agendasGroupsDtos);

        const savedAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*')
            .whereIn(
                'agenda_id',
                agendasGroupsDtos.map((dto) => dto.agenda_id)
            )
            .whereIn(
                'group_id',
                agendasGroupsDtos.map((dto) => dto.group_id)
            );

        expect(savedAgendasGroups.length).toBe(3);
    });

    it('should not create a batch of agenda groups when one of them already exists and make a rollback', async () => {
        const agendasGroup = await AgendasGroupsMother.create(agendasGroupsRepository);

        const agendasGroupsDtos = [
            AgendasGroupsMother.dto(),
            AgendasGroupsMother.dto({ agenda_id: agendasGroup.agenda_id.value, group_id: agendasGroup.group_id.value }),
        ];

        // El primero del lote es nuevo y llega a insertarse: sin respaldo, el
        // lote cae por clave foranea antes de llegar al duplicado que se prueba.
        for (const dto of agendasGroupsDtos) {
            await AgendasGroupsMother.ensureRelations(agendasGroupsRepository.connection, dto);
        }

        const agendasGroupsBatchCreator = new AgendasGroupsBatchCreator(agendasGroupsRepository);

        await expect(agendasGroupsBatchCreator.execute(agendasGroupsDtos)).rejects.toThrow(
            expect.any(ValidationFailError || CustomError)
        );

        const savedAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*');

        expect(savedAgendasGroups.length).toBe(1);
    });

    it('should delete a batch of agenda groups', async () => {
        const agendasGroupsDtos = [];

        for (let i = 0; i < 3; i++) {
            agendasGroupsDtos.push(AgendasGroupsMother.dto());
        }

        for (const dto of agendasGroupsDtos) {
            await AgendasGroupsMother.create(agendasGroupsRepository, dto);
        }

        const savedAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*');

        expect(savedAgendasGroups.length).toBe(3);

        const agendasGroupsBatchDeleter = new AgendasGroupsBatchDeleter(agendasGroupsRepository);
        await agendasGroupsBatchDeleter.execute(agendasGroupsDtos);

        const remainingAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*')
            .whereIn(
                'agenda_id',
                agendasGroupsDtos.map((dto) => dto.agenda_id)
            )
            .whereIn(
                'group_id',
                agendasGroupsDtos.map((dto) => dto.group_id)
            );

        expect(remainingAgendasGroups.length).toBe(0);
    });

    it('should not delete a batch of agenda groups when one of them does not exist and make a rollback', async () => {
        const agendasGroup = await AgendasGroupsMother.create(agendasGroupsRepository);

        const agendasGroupsDtos = [
            { agenda_id: agendasGroup.agenda_id.value, group_id: agendasGroup.group_id.value },
            AgendasGroupsMother.dto(),
        ];

        const savedAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*');

        expect(savedAgendasGroups.length).toBe(1);

        const agendasGroupsBatchDeleter = new AgendasGroupsBatchDeleter(agendasGroupsRepository);

        await expect(agendasGroupsBatchDeleter.execute(agendasGroupsDtos)).rejects.toThrow(
            expect.any(ValidationFailError || CustomError)
        );

        const remainingAgendasGroups = await agendasGroupsRepository
            .connection(agendasGroupsRepository.tableName)
            .select('*')
            .whereIn(
                'agenda_id',
                agendasGroupsDtos.map((dto) => dto.agenda_id)
            )
            .whereIn(
                'group_id',
                agendasGroupsDtos.map((dto) => dto.group_id)
            );

        expect(remainingAgendasGroups.length).toBe(1);
    });
});
