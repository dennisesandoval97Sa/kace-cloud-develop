import { Agenda } from '../../src/agendas/domain/Agenda';
import {
    ValueObjectDescription,
    ValueObjectDailyLimit,
    ValueObjectIsActive,
    ValueObjectOneScriptId,
} from '../../src/agendas/domain/value-objects';
import { DeleteFieldsDoNotExistError, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import { AgendasMother } from './domain/AgendasMother';
import { v4 as uuidv4 } from 'uuid';
import { AgendaResponse } from '../../src/agendas/application/AgendaResponse';
import { AgendaCollectionResponse } from '../../src/agendas/application/AgendaCollectionResponse';

describe('Agenda Entity', () => {
    const DAILY_LIMIT_RANGE_ALERT = 'daily_limit: The value must be between 0 and 1000';
    const DESCRIPTION_MISSING_ALERT = 'description: The value cannot be null';
    const SCRIPT_ID_MISSING_ALERT = 'one_script_id: The value cannot be null';

    const dto = AgendasMother.dto();

    it('should throw an error if the daily limit is less than 0', () => {
        const dtoWithInvalidDailyLimit = { ...dto, daily_limit: -1 };

        expect(() => Agenda.create(dtoWithInvalidDailyLimit)).toThrow(DAILY_LIMIT_RANGE_ALERT);
    });

    it('should throw an error if the daily limit is greater than 1000', () => {
        const dtoWithInvalidDailyLimit = { ...dto, daily_limit: 1001 };

        expect(() => Agenda.create(dtoWithInvalidDailyLimit)).toThrow(DAILY_LIMIT_RANGE_ALERT);
    });

    it('should throw an error if the description is empty', () => {
        const dtoWithEmptyDescription = { ...dto, description: '' };

        expect(() => Agenda.create(dtoWithEmptyDescription)).toThrow(DESCRIPTION_MISSING_ALERT);
    });

    it('should return a Agenda entity', () => {
        const agenda = Agenda.create(dto);

        expect(agenda).toBeInstanceOf(Agenda);
    });

    it('should create an Agenda entity', () => {
        const agenda = Agenda.create(dto);

        expect(agenda.id).toBeInstanceOf(ValueObjectUuid);
        expect(agenda.id.value).toBe(dto.id);

        expect(agenda.description).toBeInstanceOf(ValueObjectDescription);
        expect(agenda.description.value).toBe(dto.description);

        expect(agenda.is_active).toBeInstanceOf(ValueObjectIsActive);
        expect(agenda.is_active.value).toBe(dto.is_active);

        expect(agenda.one_script_id).toBeInstanceOf(ValueObjectOneScriptId);
        expect(agenda.one_script_id.value).toBe(dto.one_script_id);

        expect(agenda.daily_limit).toBeInstanceOf(ValueObjectDailyLimit);
        expect(agenda.daily_limit.value).toBe(dto.daily_limit);

        expect(agenda.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(agenda.created_at.value).toBe(dto.created_at);

        expect(agenda.created_by).toBeInstanceOf(ValueObjectUuid);
        expect(agenda.created_by.value).toBe(dto.created_by);
    });

    it('should throw an error if the daily limit is less than 0 when updating', () => {
        const agenda = Agenda.create(dto);
        const newData = { ...dto, daily_limit: -1 };

        expect(() => agenda.update(newData)).toThrow(DAILY_LIMIT_RANGE_ALERT);
    });

    it('should throw an error if the daily limit is greater than 1000 when updating', () => {
        const agenda = Agenda.create(dto);
        const newData = { ...dto, daily_limit: 1001 };

        expect(() => agenda.update(newData)).toThrow(DAILY_LIMIT_RANGE_ALERT);
    });

    it('should update the data', () => {
        const agenda = Agenda.create(dto);
        const newUuid = uuidv4();

        const newData = {
            description: 'new description',
            is_active: false,
            one_script_id: newUuid,
            daily_limit: 100,
        };

        agenda.update(newData);

        expect(agenda.changedAttributes).toEqual({
            description: 'new description',
            is_active: false,
            one_script_id: newUuid,
            daily_limit: 100,
        });
    });

    it('does not update the data if the new data is the same as the old data', () => {
        const agenda = Agenda.create(dto);

        const newData = {
            description: dto.description,
            is_active: dto.is_active,
            one_script_id: dto.one_script_id,
            daily_limit: dto.daily_limit,
        };

        agenda.update(newData);

        expect(agenda.changedAttributes).toEqual({});
    });

    it('marks the entity as deleted', () => {
        const agenda = Agenda.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        agenda.delete(deleteDto);

        expect(agenda.deleted_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(agenda.deleted_at.value).not.toBeNull();

        expect(agenda.deleted_by).toBeInstanceOf(ValueObjectUuid);
        expect(agenda.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should throw an error if the deleteDto is missing', () => {
        const agenda = Agenda.create(dto);

        const deleteDto = {};

        expect(() => agenda.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes the changed attributes', () => {
        const agenda = Agenda.create(dto);

        const updateDto = {
            description: 'new description',
            is_active: false,
            one_script_id: uuidv4(),
            daily_limit: 100,
        };

        agenda.update(updateDto);
        agenda.flushChanges();

        expect(agenda.changedAttributes).toEqual({});
    });
});

describe('Agenda Responses Tests', () => {
    const dto = AgendasMother.dto();

    it('converts Agenda object to a response object', () => {
        const agenda = new Agenda(dto);
        const agendaResponse = new AgendaResponse(agenda);
        const agendaResponseJson = agendaResponse.toJson();
        const expectedJson = {
            data: {
                id: agenda.id.value,
                description: agenda.description.value,
                is_active: agenda.is_active.value,
                one_script_id: agenda.one_script_id.value,
                daily_limit: agenda.daily_limit.value,
                created_at: agenda.created_at.value,
                updated_at: agenda.updated_at.value,
                created_by: agenda.created_by.value,
                updated_by: agenda.updated_by.value,
                deleted_at: agenda.deleted_at.value,
                deleted_by: agenda.deleted_by.value,
            },
        };

        expect(agendaResponseJson).toMatchObject(expectedJson);
    });

    it('returns an empty object if the Agenda object is null', () => {
        const agendaResponse = new AgendaResponse(null);
        expect(agendaResponse.toJson()).toMatchObject({});
    });

    it('returns an empty object if the Agenda object is undefined', () => {
        const agendaResponse = new AgendaResponse(undefined);
        expect(agendaResponse.toJson()).toMatchObject({});
    });

    it('Converts agendas to collection response', () => {
        const agendas = [new Agenda(dto), new Agenda(dto)];
        const agendaCollectionResponse = new AgendaCollectionResponse(agendas, 2);
        const agendaCollectionResponseJson = agendaCollectionResponse.toJson();

        const expectedJson = {
            data: {
                items: agendas.map((agenda) => new AgendaResponse(agenda).toJson().data),
            },
            metadata: {
                count: 2,
            },
        };

        expect(agendaCollectionResponseJson).toMatchObject(expectedJson);
    });
});
