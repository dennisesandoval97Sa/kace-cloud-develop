import {
    UserNotification,
    UserNotificationCollectionResponse,
    UserNotificationResponse,
} from '../../src/user-notifications';
import { v4 as uuidV4 } from 'uuid';
import { ValueObjectBoolean, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import { ValueObjectMessage } from '../../src/user-notifications/domain/ValueObjectMessage';
import { ValueObjectSubject } from '../../src/user-notifications/domain/ValueObjectSubject';
import UserNotificationsMother from './domain/UserNotificationsMother';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';

describe('UserNotification Entity', () => {
    const dto = UserNotificationsMother.dto();

    it('should create a UserNotification with valid data', () => {
        const userNotification = UserNotification.create(dto);
        expect(userNotification.id).toBeInstanceOf(ValueObjectUuid);
        expect(userNotification.is_active).toBeInstanceOf(ValueObjectBoolean);
        expect(userNotification.fecha_inicio).toBeInstanceOf(ValueObjectTimestamp);
        expect(userNotification.fecha_fin).toBeInstanceOf(ValueObjectTimestamp);
    });

    it('should update UserNotification data', () => {
        const userNotification = UserNotification.create(dto);
        const newData = {
            asunto: 'Updated Subject',
            mensaje: 'Updated Message',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        userNotification.update(newData);

        expect(userNotification.asunto.value).toBe(newData.asunto);
        expect(userNotification.mensaje.value).toBe(newData.mensaje);
        expect(userNotification.changedAttributes).toEqual(newData);
    });

    it('should update UserNotification attributes via setters', () => {
        const userNotification = UserNotification.create(dto);

        userNotification.asunto = 'Updated Subject';
        userNotification.mensaje = 'Updated Message';
        userNotification.fecha_inicio = new Date().toISOString();
        userNotification.fecha_fin = new Date().toISOString();
        userNotification.leida = true;
        userNotification.leida_por = '123e4567-e89b-12d3-a456-426614174003';
        userNotification.user_id = '123e4567-e89b-12d3-a456-426614174004';
        userNotification.is_active = false;

        expect(userNotification.changedAttributes).toEqual({
            asunto: 'Updated Subject',
            mensaje: 'Updated Message',
            fecha_inicio: userNotification.fecha_inicio.value,
            fecha_fin: userNotification.fecha_fin.value,
            leida: true,
            leida_por: '123e4567-e89b-12d3-a456-426614174003',
            user_id: '123e4567-e89b-12d3-a456-426614174004',
            is_active: false,
        });
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => UserNotification.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const dto = UserNotificationsMother.dto();
        const userNotification = UserNotification.create(dto);
        delete dto.id;
        delete dto.created_at;
        delete dto.created_by;

        userNotification.update(dto);

        expect(userNotification.changedAttributes).toEqual({});
    });

    it('marks a UserNotification instance as deleted', () => {
        const dto = UserNotificationsMother.dto();
        const userNotification = UserNotification.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };
        userNotification.delete(deleteDto);

        expect(userNotification.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(userNotification.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const dto = UserNotificationsMother.dto();
        const userNotification = UserNotification.create(dto);
        const deleteDto = {};

        expect(() => userNotification.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in UserNotification instance', () => {
        const dto = UserNotificationsMother.dto();
        const userNotification = UserNotification.create(dto);
        const updateDto = {
            subject: 'Updated Subject',
            message: 'Updated Message',
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            is_read: true,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        userNotification.update(updateDto);
        userNotification.flushChanges();

        expect(userNotification.changedAttributes).toEqual({});
    });
});

describe('UserNotification Responses Tests', () => {
    it('converts UserNotification object to JSON representation', () => {
        const userNotification = UserNotification.create(UserNotificationsMother.dto());
        const userNotificationResponse = new UserNotificationResponse(userNotification);

        const json = userNotificationResponse.toJson();

        expect(json).toEqual({
            data: {
                id: userNotification.id.value,
                asunto: userNotification.asunto.value,
                mensaje: userNotification.mensaje.value,
                fecha_inicio: userNotification.fecha_inicio.value,
                fecha_fin: userNotification.fecha_fin.value,
                leida: userNotification.leida.value,
                leida_por: userNotification.leida_por.value,
                user_id: userNotification.user_id.value,
                is_active: userNotification.is_active.value,
                created_at: userNotification.created_at.value,
                updated_at: userNotification.updated_at.value,
                created_by: userNotification.created_by.value,
                updated_by: userNotification.updated_by.value,
            },
        });
    });

    it('returns an empty object if notification is not provided', () => {
        const userNotificationResponse = new UserNotificationResponse(null);
        const json = userNotificationResponse.toJson();

        expect(json).toEqual({});
    });

    it('converts UserNotificationCollection to JSON representation', () => {
        const userNotificationCollection = [
            new UserNotification(UserNotificationsMother.dto()),
            new UserNotification(UserNotificationsMother.dto()),
        ];
        const userNotificationCollectionResponse = new UserNotificationCollectionResponse(
            userNotificationCollection,
            userNotificationCollection.length
        );

        const json = userNotificationCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: userNotificationCollection.map(
                    (userNotification) => new UserNotificationResponse(userNotification).toJson().data
                ),
            },
            metadata: {
                count: userNotificationCollection.length,
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
