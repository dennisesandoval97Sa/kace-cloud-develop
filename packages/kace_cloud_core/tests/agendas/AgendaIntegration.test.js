import { AgendaResponse } from '../../src/agendas/application/AgendaResponse.js';
import { AgendaCreator } from '../../src/agendas/application/create/AgendaCreator';
import { AgendaFinder } from '../../src/agendas/application/find/AgendaFinder.js';
import { KnexAgendaRepository } from '../../src/agendas/infrastructure/persistence/KnexAgendaRepository';
import { KnexOneScriptRepository } from '../../src/one-script/index.js';
import { knexConfig } from '../knexfile.js';
import OneScriptMother from '../one-script/domain/OneScriptMother.js';
import { AgendasMother } from './domain/AgendasMother.js';
import { AgendaUpdater } from '../../src/agendas/application/update/AgendaUpdater.js';
import { FindAllAgendas } from '../../src/agendas/application/find-all/FindAllAgendas.js';
import { AgendaCollectionResponse } from '../../src/agendas/application/AgendaCollectionResponse.js';
import { AgendaDeleter } from '../../src/agendas/application/delete/AgendaDeleter.js';
import { v4 as uuidv4 } from 'uuid';
import { Agenda } from '../../src/agendas/domain/Agenda.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { AgendaSearcher } from '../../src/agendas/application/search/AgendaSearcher.js';
import { AppointmentTimeSlotsMother } from '../appointment-time-slots/domain/AppointmentTimeSlotsMother.js';
import { KnexAppointmentTimeSlotsRepository } from '../../src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots';

describe('Agenda Integration Tests', () => {
    const agendaRepository = new KnexAgendaRepository(knexConfig);
    const oneScriptRepository = new KnexOneScriptRepository(agendaRepository.connection);
    const appointmentTimeSlotsRepository = new KnexAppointmentTimeSlotsRepository(agendaRepository.connection);

    it('should create an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaDto = AgendasMother.dto(oneScript.id.value);

        const agendaCreator = new AgendaCreator(agendaRepository);
        await agendaCreator.execute(agendaDto);

        const agenda = await agendaRepository.connection('agendas').where({ id: agendaDto.id }).first();

        expect(agenda.id).toEqual(agendaDto.id);
    });

    it('should not create an agenda with an existing id', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaDto = AgendasMother.dto(oneScript.id.value);

        const agendaCreator = new AgendaCreator(agendaRepository);
        await agendaCreator.execute(agendaDto);

        await expect(agendaCreator.execute(agendaDto)).rejects.toThrow(ValidationFailError);
    });

    it('should find an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        const agendaFinder = new AgendaFinder(agendaRepository);
        const foundAgendaResponse = await agendaFinder.execute(agenda.id.value);

        expect(foundAgendaResponse).not.toBeNull();
        expect(foundAgendaResponse).toBeInstanceOf(AgendaResponse);
    });

    it('should find all agendas', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        await AgendasMother.createMany(agendaRepository, 5, oneScript.id.value);

        const agendaFinder = new FindAllAgendas(agendaRepository);
        const foundAgendasCollectionResponse = await agendaFinder.execute();

        expect(foundAgendasCollectionResponse).not.toBeNull();
        expect(foundAgendasCollectionResponse).toBeInstanceOf(AgendaCollectionResponse);
    });

    it('should update an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        const valuesToUpdate = {
            description: 'Updated Description',
        };
        const agendaUpdater = new AgendaUpdater(agendaRepository);
        await agendaUpdater.execute(agenda.id.value, valuesToUpdate);

        const updatedAgenda = await agendaRepository.find(agenda.id);

        expect(updatedAgenda.description.value).toEqual(valuesToUpdate.description);
    });

    it('should delete an agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        const agendaDeleter = new AgendaDeleter(agendaRepository);
        await agendaDeleter.execute(agenda.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const deletedAgenda = await agendaRepository.find(agenda.id);

        expect(deletedAgenda).toBeInstanceOf(Agenda);
        expect(deletedAgenda.deleted_at).not.toBeNull();
    });

    it('should not delete an already deleted agenda', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        const agendaDeleter = new AgendaDeleter(agendaRepository);
        await agendaDeleter.execute(agenda.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        await expect(
            agendaDeleter.execute(agenda.id.value, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(ValidationFailError);
    });

    it('should not delete an agenda with created time slots', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agenda.id.value);

        const agendaDeleter = new AgendaDeleter(agendaRepository);

        await expect(
            agendaDeleter.execute(agenda.id.value, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(ValidationFailError);
    });

    it('Searches for agendas instances with given criteria', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        await AgendasMother.createMany(agendaRepository, 5, oneScript.id.value);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
        };

        const agendaCriteria = new AgendaSearcher(agendaRepository);
        const agendasCollectionResponse = await agendaCriteria.execute(dtoCriteria);

        expect(agendasCollectionResponse).not.toBeNull();
        expect(agendasCollectionResponse).toBeInstanceOf(AgendaCollectionResponse);
        expect(agendasCollectionResponse.toJson().data.items).toHaveLength(5);
        expect(new Date(agendasCollectionResponse.toJson().data.items[0].created_at).getTime()).toBeLessThan(
            new Date(agendasCollectionResponse.toJson().data.items[4].created_at).getTime()
        );
    });

    it('Should create an agenda with is for weekend', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaDto = AgendasMother.dto(oneScript.id.value);

        const agendaCreator = new AgendaCreator(agendaRepository);
        await agendaCreator.execute({
            ...agendaDto,
            is_for_weekend: true,
        });

        const agenda = await agendaRepository.connection('agendas').where({ id: agendaDto.id }).first();

        expect(agenda.id).toEqual(agendaDto.id);
        expect(agenda.is_for_weekend).toEqual(true);
    });

    it('Should create an agenda with is not for weekend and this is the default value', async () => {
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
        const agendaDto = AgendasMother.dto(oneScript.id.value);

        const agendaCreator = new AgendaCreator(agendaRepository);
        await agendaCreator.execute(agendaDto);

        const agenda = await agendaRepository.connection('agendas').where({ id: agendaDto.id }).first();

        expect(agenda.id).toEqual(agendaDto.id);
        expect(agenda.is_for_weekend).toEqual(false);
    });
});
