import { EventCollectionResponse, EventLog, EventResponse } from '../../src/event-log/index';
import EventLogMother from './domain/EventLogMother';
import { v4 as uuidv4 } from 'uuid';

describe('EventLog Entity', () => {
    const dto = EventLogMother.dto();

    it('should create an EventLog with valid data', () => {
        const eventLog = EventLog.create(dto);

        expect(eventLog.id.value).toBe(dto.id);
        expect(eventLog.event_name.value).toBe(dto.event_name);
        expect(eventLog.initiated_by_user.value).toBe(dto.initiated_by_user);
        expect(eventLog.body.value).toBe(dto.body);
        expect(eventLog.aggregate_id.value).toEqual(dto.aggregate_id);
        expect(eventLog.occurred_at.value).toBe(dto.occurred_at);
    });

    it('should update EventLog fields', () => {
        const eventLog = EventLog.create(dto);

        const updatedValues = {
            event_name: 'UserUpdated',
            occurred_at: new Date().toISOString(),
            initiated_by_user: uuidv4(),
            aggregate_id: uuidv4(),
            body: { userId: uuidv4(), name: 'Jane Doe' },
            case_id: uuidv4(),
            client_id: uuidv4(),
        };

        eventLog.event_name = updatedValues.event_name;
        eventLog.occurred_at = updatedValues.occurred_at;
        eventLog.initiated_by_user = updatedValues.initiated_by_user;
        eventLog.aggregate_id = updatedValues.aggregate_id;
        eventLog.body = updatedValues.body;
        eventLog.case_id = updatedValues.case_id;
        eventLog.client_id = updatedValues.client_id;

        expect(eventLog.event_name.value).toBe(updatedValues.event_name);
        expect(eventLog.occurred_at.value).toBe(updatedValues.occurred_at);
        expect(eventLog.initiated_by_user.value).toBe(updatedValues.initiated_by_user);
        expect(eventLog.aggregate_id.value).toBe(updatedValues.aggregate_id);
        expect(eventLog.body.value).toEqual(updatedValues.body);
        expect(eventLog.case_id.value).toBe(updatedValues.case_id);
        expect(eventLog.client_id.value).toBe(updatedValues.client_id);

        expect(eventLog.changedAttributes).toEqual({
            event_name: updatedValues.event_name,
            occurred_at: updatedValues.occurred_at,
            initiated_by_user: updatedValues.initiated_by_user,
            aggregate_id: updatedValues.aggregate_id,
            body: updatedValues.body,
            case_id: updatedValues.case_id,
            client_id: updatedValues.client_id,
        });
    });

    it('should not mark unchanged attributes as changed', () => {
        const eventLog = EventLog.create(dto);
        eventLog.event_name = dto.event_name;
        eventLog.occurred_at = dto.occurred_at;
        eventLog.initiated_by_user = dto.initiated_by_user;
        eventLog.aggregate_id = dto.aggregate_id;
        eventLog.body = dto.body;
        eventLog.case_id = dto.case_id;
        eventLog.client_id = dto.client_id;

        expect(eventLog.changedAttributes).toEqual({});
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => EventLog.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('marks an EventLog instance as deleted', () => {
        const eventLog = EventLog.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        eventLog.delete(deleteDto);

        expect(eventLog.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(eventLog.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should flush changes', () => {
        const eventLog = EventLog.create(dto);
        eventLog.event_name = 'case.newEvent';

        expect(eventLog.changedAttributes).toHaveProperty('event_name');

        eventLog.flushChanges();

        expect(eventLog.changedAttributes).toEqual({});
    });
});

describe('EventLog Responses Tests', () => {
    it('converts EventLog object to JSON representation', () => {
        const eventLog = EventLog.create(EventLogMother.dto());
        const eventResponse = new EventResponse(eventLog);

        const json = eventResponse.toJson();

        expect(json).toEqual({
            data: {
                id: eventLog.id.value,
                event_name: eventLog.event_name.value,
                occurred_at: eventLog.occurred_at.value,
                initiated_by_user: eventLog.initiated_by_user.value,
                aggregate_id: eventLog.aggregate_id.value,
                body: eventLog.body.value,
                old_data: eventLog.old_data.value,
                case_id: eventLog.case_id?.value ?? null,
                client_id: eventLog.client_id?.value ?? null,
            },
        });
    });

    it('converts EventLogCollection to JSON representation', () => {
        const eventLogCollection = [EventLog.create(EventLogMother.dto()), EventLog.create(EventLogMother.dto())];

        const eventCollectionResponse = new EventCollectionResponse(eventLogCollection, eventLogCollection.length);

        const json = eventCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: eventLogCollection.map((eventLog) => new EventResponse(eventLog).toJson().data),
            },
            metadata: {
                count: eventLogCollection.length,
            },
        });
    });
});
