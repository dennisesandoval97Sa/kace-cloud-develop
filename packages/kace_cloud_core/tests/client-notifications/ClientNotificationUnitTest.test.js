import {
    ClientNotification,
    ClientNotificationCollectionResponse,
    ClientNotificationResponse,
} from '../../src/client-notifications';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectBoolean, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import ClientNotificationsMother from './domain/ClientNotificationsMother';
import { ValueObjectMessage } from '../../src/client-notifications/domain/ValueObjectMessage';
import { ValueObjectSubject } from '../../src/client-notifications/domain/ValueObjectSubject';

describe('ClientNotification Entity', () => {
    const dto = ClientNotificationsMother.dto();

    it('should create a client notification with valid data', () => {
        const clientNotification = ClientNotification.create(dto);
        expect(clientNotification.id).toBeInstanceOf(ValueObjectUuid);
        expect(clientNotification.is_active).toBeInstanceOf(ValueObjectBoolean);
        expect(clientNotification.start_date).toBeInstanceOf(ValueObjectTimestamp);
        expect(clientNotification.end_date).toBeInstanceOf(ValueObjectTimestamp);
    });

    it('should update client notification data', () => {
        const clientNotification = ClientNotification.create(dto);
        const newSubject = 'Updated Subject';
        const newData = {
            subject: newSubject,
            message: 'Updated Message',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        clientNotification.update(newData);

        expect(clientNotification.subject.value).toBe(newSubject);
        expect(clientNotification.message.value).toBe(newData.message);
        expect(clientNotification.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';

        expect(() => ClientNotification.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const dto = ClientNotificationsMother.dto();
        const clientNotification = ClientNotification.create(dto);
        delete dto.id;
        delete dto.created_at;
        delete dto.created_by;

        clientNotification.update(dto);

        expect(clientNotification.changedAttributes).toEqual({});
    });

    it('marks a ClientNotification instance as deleted', () => {
        const dto = ClientNotificationsMother.dto();
        const clientNotification = ClientNotification.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        clientNotification.delete(deleteDto);

        expect(clientNotification.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(clientNotification.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in ClientNotification instance', () => {
        const dto = ClientNotificationsMother.dto();
        const clientNotification = ClientNotification.create(dto);
        const updateDto = {
            subject: 'Updated Subject',
            message: 'Updated Message',
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            is_read: true,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        clientNotification.update(updateDto);
        clientNotification.flushChanges();

        expect(clientNotification.changedAttributes).toEqual({});
    });
});

describe('ClientNotification Responses Tests', () => {
    it('converts ClientNotification object to JSON representation', () => {
        const clientNotification = new ClientNotification(ClientNotificationsMother.dto());
        const clientNotificationResponse = new ClientNotificationResponse(clientNotification);

        const json = clientNotificationResponse.toJson();

        expect(json).toEqual({
            data: {
                id: clientNotification.id.value,
                client_id: clientNotification.client_id.value,
                subject: clientNotification.subject.value,
                message: clientNotification.message.value,
                start_date: clientNotification.start_date.value,
                end_date: clientNotification.end_date.value,
                is_read: clientNotification.is_read.value,
                read_by: clientNotification.read_by.value,
                is_active: clientNotification.is_active.value,
                created_at: clientNotification.created_at.value,
                updated_at: clientNotification.updated_at.value,
                created_by: clientNotification.created_by.value,
                updated_by: clientNotification.updated_by.value,
            },
        });
    });

    it('converts ClientNotificationCollection to JSON representation', () => {
        const clientNotificationCollection = [
            new ClientNotification(ClientNotificationsMother.dto()),
            new ClientNotification(ClientNotificationsMother.dto()),
        ];
        const clientNotificationCollectionResponse = new ClientNotificationCollectionResponse(
            clientNotificationCollection,
            clientNotificationCollection.length
        );

        const json = clientNotificationCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: clientNotificationCollection.map(
                    (clientNotification) => new ClientNotificationResponse(clientNotification).toJson().data
                ),
            },
            metadata: {
                count: clientNotificationCollection.length,
            },
        });
    });
});

describe('ValueObjectMessage Tests', () => {
    it('should create a ValueObjectMessage with valid value', () => {
        const valueObject = new ValueObjectMessage('message', 'Valid message');
        expect(valueObject).toBeInstanceOf(ValueObjectMessage);
        expect(valueObject.value).toBe('Valid message');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectMessage('message', null, false)).toThrow('message: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectMessage('message', null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(1001);
        expect(() => new ValueObjectMessage('message', longValue)).toThrow(
            'message: The value must be at most 1000 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectMessage('message', 123)).toThrow('message: The value must be a string');
    });
});

describe('ValueObjectSubject Tests', () => {
    it('should create a ValueObjectSubject with valid value', () => {
        const valueObject = new ValueObjectSubject('subject', 'Valid Subject');
        expect(valueObject).toBeInstanceOf(ValueObjectSubject);
        expect(valueObject.value).toBe('Valid Subject');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectSubject('subject', null, false)).toThrow('subject: The value cannot be null');
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectSubject('subject', null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(26);
        expect(() => new ValueObjectSubject('subject', longValue)).toThrow(
            'subject: The value must be at most 25 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectSubject('subject', 123)).toThrow('subject: The value must be a string');
    });
});
