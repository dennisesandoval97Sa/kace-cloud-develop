import { Geolocation } from '../../src/geolocation/domain/Geolocation.js';
import {
    ValueObjectActionType,
    ValueObjectLatitud,
    ValueObjectLongitud,
    ValueObjectIp4Address,
    ValueObjectMetadata,
} from '../../src/geolocation/domain/value-objects';
import { ValueObjectTimestamp, ValueObjectUuid, DeleteFieldsDoNotExistError } from '../../src/shared';
import { GeolocationsMother } from './domain/GeolocationsMother.js';
import { v4 as uuidv4 } from 'uuid';

describe('Geolocation Entity', () => {
    const METADATA_MUST_BE_OBJECT = 'metadata: The value must be an object';
    const ACTION_TYPE_MISSING_ALERT = 'action_type: The value cannot be null';
    const LATITUD_MISSING_ALERT = 'latitud: The value cannot be null';
    const LATITUD_MUST_BE_STRING = 'latitud: The value must be a string';
    const LONGITUD_MISSING_ALERT = 'longitud: The value cannot be null';

    const dto = GeolocationsMother.dto();

    it('should throw an error if the metadata is not an object', () => {
        const dtoWithInvalidMetadata = { ...dto, metadata: '"invalid"' };

        expect(() => Geolocation.create(dtoWithInvalidMetadata)).toThrow(METADATA_MUST_BE_OBJECT);
    });

    it('should throw an error if latitude is not a string', () => {
        const dtoWithInvalidLatitude = { ...dto, latitud: 12345 };

        expect(() => Geolocation.create(dtoWithInvalidLatitude)).toThrow(LATITUD_MUST_BE_STRING);
    });

    it('should throw an error if the action type is empty', () => {
        const dtoWithEmptyActionType = { ...dto, action_type: '' };

        expect(() => Geolocation.create(dtoWithEmptyActionType)).toThrow(ACTION_TYPE_MISSING_ALERT);
    });

    it('should throw an error if the latitude is empty', () => {
        const dtoWithEmptyLatitud = { ...dto, latitud: '' };

        expect(() => Geolocation.create(dtoWithEmptyLatitud)).toThrow(LATITUD_MISSING_ALERT);
    });

    it('should throw an error if the longitude is empty', () => {
        const dtoWithEmptyLongitud = { ...dto, longitud: '' };

        expect(() => Geolocation.create(dtoWithEmptyLongitud)).toThrow(LONGITUD_MISSING_ALERT);
    });

    it('should return a Geolocation entity', () => {
        const geolocation = Geolocation.create(dto);

        expect(geolocation).toBeInstanceOf(Geolocation);
    });

    it('should create a Geolocation entity', () => {
        const geolocation = Geolocation.create(dto);

        expect(geolocation.id).toBeInstanceOf(ValueObjectUuid);
        expect(geolocation.id.value).toBe(dto.id);

        expect(geolocation.user_id).toBeInstanceOf(ValueObjectUuid);
        expect(geolocation.user_id.value).toBe(dto.user_id);

        expect(geolocation.action_type).toBeInstanceOf(ValueObjectActionType);
        expect(geolocation.action_type.value).toBe(dto.action_type);

        expect(geolocation.latitud).toBeInstanceOf(ValueObjectLatitud);
        expect(geolocation.latitud.value).toBe(dto.latitud);

        expect(geolocation.longitud).toBeInstanceOf(ValueObjectLongitud);
        expect(geolocation.longitud.value).toBe(dto.longitud);

        expect(geolocation.ip4_address).toBeInstanceOf(ValueObjectIp4Address);
        expect(geolocation.ip4_address.value).toBe(dto.ip4_address);

        expect(geolocation.metadata).toBeInstanceOf(ValueObjectMetadata);
        expect(geolocation.metadata.value).toEqual(dto.metadata);

        expect(geolocation.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(geolocation.created_at.value).toBe(dto.created_at);

        expect(geolocation.created_by).toBeInstanceOf(ValueObjectUuid);
        expect(geolocation.created_by.value).toBe(dto.created_by);
    });

    it('should update the data', () => {
        const geolocation = Geolocation.create(dto);
        const newData = {
            action_type: 'Updated Action',
            latitud: '41.7128',
            longitud: '-75.0060',
            ip4_address: '192.168.1.2',
            metadata: { key: 'new_value' },
        };

        geolocation.update(newData);

        expect(geolocation.action_type.value).toBe(newData.action_type);
        expect(geolocation.latitud.value).toBe(newData.latitud);
        expect(geolocation.longitud.value).toBe(newData.longitud);
        expect(geolocation.ip4_address.value).toBe(newData.ip4_address);
        expect(geolocation.metadata.value).toEqual(newData.metadata);
        expect(geolocation.changedAttributes).toEqual({
            action_type: 'Updated Action',
            latitud: '41.7128',
            longitud: '-75.0060',
            ip4_address: '192.168.1.2',
            metadata: { key: 'new_value' },
        });
    });

    it('does not update the data if the new data is the same as the old data', () => {
        const geolocation = Geolocation.create(dto);

        const newData = {
            action_type: dto.action_type,
            latitud: dto.latitud,
            longitud: dto.longitud,
            ip4_address: dto.ip4_address,
            metadata: dto.metadata,
        };

        geolocation.update(newData);

        expect(geolocation.changedAttributes).toEqual({});
    });

    it('marks the entity as deleted', () => {
        const geolocation = Geolocation.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        geolocation.delete(deleteDto);

        expect(geolocation.deleted_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(geolocation.deleted_at.value).not.toBeNull();

        expect(geolocation.deleted_by).toBeInstanceOf(ValueObjectUuid);
        expect(geolocation.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should throw an error if the deleteDto is missing', () => {
        const geolocation = Geolocation.create(dto);

        const deleteDto = {};

        expect(() => geolocation.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes the changed attributes', () => {
        const geolocation = Geolocation.create(dto);

        const updateDto = {
            action_type: 'Updated Action',
            latitud: '41.7128',
            longitud: '-75.0060',
            ip4_address: '192.168.1.2',
            metadata: { key: 'new_value' },
        };

        geolocation.update(updateDto);
        geolocation.flushChanges();

        expect(geolocation.changedAttributes).toEqual({});
    });

    it('should throw an error if the deleteDto is missing "deleted_at" field', () => {
        const geolocation = Geolocation.create(dto);

        const deleteDto = {
            deleted_by: uuidv4(),
        };

        expect(() => geolocation.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should throw an error if the deleteDto is missing "deleted_by" field', () => {
        const geolocation = Geolocation.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
        };

        expect(() => geolocation.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should set the "deleted_at" and "deleted_by" values correctly', () => {
        const geolocation = Geolocation.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        geolocation.delete(deleteDto);

        expect(geolocation.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(geolocation.deleted_by.value).toBe(deleteDto.deleted_by);
    });
});
