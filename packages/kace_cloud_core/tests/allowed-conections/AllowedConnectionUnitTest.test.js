import {
    AllowedConnection,
    AllowedConnectionCollectionResponse,
    AllowedConnectionResponse,
} from '../../src/allowed-conections';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectBoolean, ValueObjectDescription, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import AllowedConnectionsMother from './domain/AllowedConnectionsMother';
import { ValueObjectConnection } from '../../src/allowed-conections/domain/ValueObjectConnection';
import { ValueObjectCertificate } from '../../src/allowed-conections/domain/ValueObjectCertificate';
import { DeleteFieldsDoNotExistError } from '../../src/shared/errors/DeleteFieldsDoNotExistError.js';

describe('AllowedConnection Entity', () => {
    const dto = AllowedConnectionsMother.dto();

    it('should create an allowed connection with valid data', () => {
        const allowedConnection = AllowedConnection.create(dto);
        expect(allowedConnection.id).toBeInstanceOf(ValueObjectUuid);
        expect(allowedConnection.description).toBeInstanceOf(ValueObjectDescription);
        expect(allowedConnection.connection).toBeInstanceOf(ValueObjectConnection);
        expect(allowedConnection.certificate).toBeInstanceOf(ValueObjectCertificate);
        expect(allowedConnection.is_active).toBeInstanceOf(ValueObjectBoolean);
        expect(allowedConnection.created_at).toBeInstanceOf(ValueObjectTimestamp);
    });

    it('should update allowed connection data', () => {
        const allowedConnection = AllowedConnection.create(dto);
        const newData = {
            description: 'Updated Description',
            connection: 'Updated Connection',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        allowedConnection.update(newData);

        expect(allowedConnection.description.value).toBe(newData.description);
        expect(allowedConnection.connection.value).toBe(newData.connection);
        expect(allowedConnection.changedAttributes).toEqual(newData);
    });

    it('clears the certificate when HTTPS is disabled', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: 'existing-fingerprint',
            has_ssl: true,
        });

        expect(() =>
            allowedConnection.update({
                has_ssl: false,
                certificate: '',
            })
        ).not.toThrow();
        expect(allowedConnection.certificate.value).toBe('');
        expect(allowedConnection.has_ssl.value).toBe(false);
        expect(allowedConnection.changedAttributes).toMatchObject({
            certificate: '',
            has_ssl: false,
        });
    });

    it.each([true, 1])('rejects creating an HTTPS connection without a certificate using %p', (hasSsl) => {
        expect(() =>
            AllowedConnection.create({
                ...AllowedConnectionsMother.dto(),
                certificate: '',
                has_ssl: hasSsl,
            })
        ).toThrow('certificate: The value cannot be null when HTTPS is enabled');
    });

    it.each([false, 0])('rejects creating a non-HTTPS connection with a fingerprint using %p', (hasSsl) => {
        expect(() =>
            AllowedConnection.create({
                ...AllowedConnectionsMother.dto(),
                certificate: '12341234',
                has_ssl: hasSsl,
            })
        ).toThrow('certificate: The value must be empty when HTTPS is disabled');
    });

    it('rejects clearing the certificate while HTTPS remains enabled without partially updating the entity', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: 'existing-fingerprint',
            has_ssl: true,
        });

        expect(() => allowedConnection.update({ certificate: '' })).toThrow(
            'certificate: The value cannot be null when HTTPS is enabled'
        );
        expect(allowedConnection.certificate.value).toBe('existing-fingerprint');
        expect(allowedConnection.has_ssl.value).toBe(true);
        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('rejects enabling HTTPS without a certificate without partially updating the entity', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: '',
            has_ssl: false,
        });

        expect(() => allowedConnection.update({ has_ssl: true })).toThrow(
            'certificate: The value cannot be null when HTTPS is enabled'
        );
        expect(allowedConnection.certificate.value).toBe('');
        expect(allowedConnection.has_ssl.value).toBe(false);
        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('rejects setting a fingerprint while HTTPS remains disabled without partially updating the entity', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: '',
            has_ssl: false,
        });

        expect(() => allowedConnection.update({ certificate: '12341234' })).toThrow(
            'certificate: The value must be empty when HTTPS is disabled'
        );
        expect(allowedConnection.certificate.value).toBe('');
        expect(allowedConnection.has_ssl.value).toBe(false);
        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('rejects disabling HTTPS without clearing its fingerprint', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: 'existing-fingerprint',
            has_ssl: true,
        });

        expect(() => allowedConnection.update({ has_ssl: false })).toThrow(
            'certificate: The value must be empty when HTTPS is disabled'
        );
        expect(allowedConnection.certificate.value).toBe('existing-fingerprint');
        expect(allowedConnection.has_ssl.value).toBe(true);
        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('enables HTTPS atomically when a certificate is supplied in the same update', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: '',
            has_ssl: false,
        });

        allowedConnection.update({
            has_ssl: true,
            certificate: 'new-fingerprint',
        });

        expect(allowedConnection.certificate.value).toBe('new-fingerprint');
        expect(allowedConnection.has_ssl.value).toBe(true);
        expect(allowedConnection.changedAttributes).toMatchObject({
            certificate: 'new-fingerprint',
            has_ssl: true,
        });
    });

    it('does not partially update the HTTPS fields when another field is invalid', () => {
        const allowedConnection = AllowedConnection.create({
            ...AllowedConnectionsMother.dto(),
            certificate: '',
            has_ssl: false,
        });

        expect(() =>
            allowedConnection.update({
                certificate: 'new-fingerprint',
                description: null,
                has_ssl: true,
            })
        ).toThrow('description: The value cannot be null');
        expect(allowedConnection.certificate.value).toBe('');
        expect(allowedConnection.has_ssl.value).toBe(false);
        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('rehydrates a legacy invalid row so it can be repaired by disabling HTTPS', () => {
        const allowedConnection = new AllowedConnection({
            ...AllowedConnectionsMother.dto(),
            certificate: '',
            has_ssl: true,
        });

        expect(() => allowedConnection.update({ has_ssl: false, certificate: '' })).not.toThrow();
        expect(allowedConnection.has_ssl.value).toBe(false);
        expect(allowedConnection.certificate.value).toBe('');
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';

        expect(() => AllowedConnection.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnection = AllowedConnection.create(dto);
        delete dto.id;
        delete dto.created_at;
        delete dto.created_by;

        allowedConnection.update(dto);

        expect(allowedConnection.changedAttributes).toEqual({});
    });

    it('marks an AllowedConnection instance as deleted', () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnection = AllowedConnection.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        allowedConnection.delete(deleteDto);

        expect(allowedConnection.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(allowedConnection.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnection = AllowedConnection.create(dto);
        const deleteDto = {};

        expect(() => allowedConnection.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in AllowedConnection instance', () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnection = AllowedConnection.create(dto);
        const updateDto = {
            description: 'Updated Description',
            connection: 'Updated Connection',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        allowedConnection.update(updateDto);
        allowedConnection.flushChanges();

        expect(allowedConnection.changedAttributes).toEqual({});
    });
});

describe('AllowedConnection Responses Tests', () => {
    it('converts AllowedConnection object to JSON representation', () => {
        const allowedConnection = new AllowedConnection(AllowedConnectionsMother.dto());
        const allowedConnectionResponse = new AllowedConnectionResponse(allowedConnection);

        const json = allowedConnectionResponse.toJson();

        expect(json).toEqual({
            data: {
                id: allowedConnection.id.value,
                description: allowedConnection.description.value,
                connection: allowedConnection.connection.value,
                certificate: allowedConnection.certificate.value,
                is_active: allowedConnection.is_active.value,
                created_at: allowedConnection.created_at.value,
                updated_at: allowedConnection.updated_at.value,
                created_by: allowedConnection.created_by.value,
                updated_by: allowedConnection.updated_by.value,
                has_ssl: allowedConnection.has_ssl.value,
            },
        });
    });

    it('converts AllowedConnectionCollection to JSON representation', () => {
        const allowedConnectionCollection = [
            new AllowedConnection(AllowedConnectionsMother.dto()),
            new AllowedConnection(AllowedConnectionsMother.dto()),
        ];
        const allowedConnectionCollectionResponse = new AllowedConnectionCollectionResponse(
            allowedConnectionCollection,
            allowedConnectionCollection.length
        );

        const json = allowedConnectionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: allowedConnectionCollection.map(
                    (allowedConnection) => new AllowedConnectionResponse(allowedConnection).toJson().data
                ),
            },
            metadata: {
                count: allowedConnectionCollection.length,
            },
        });
    });
});

describe('ValueObjectConnection Tests', () => {
    it('should create a ValueObjectConnection with a valid value', () => {
        const valueObject = new ValueObjectConnection('connection', 'ValidConnection.com');
        expect(valueObject).toBeInstanceOf(ValueObjectConnection);
        expect(valueObject.value).toBe('ValidConnection.com');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectConnection('connection', null, false)).toThrow(
            'connection: The value cannot be null'
        );
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectConnection('connection', null, true)).not.toThrow();
    });

    it('should throw an error when value exceeds maximum length', () => {
        const longValue = 'A'.repeat(256);
        expect(() => new ValueObjectConnection('connection', longValue)).toThrow(
            'connection: The value must be at most 255 characters long'
        );
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectConnection('connection', 123)).toThrow('connection: The value must be a string');
    });
});

describe('ValueObjectCertificate Tests', () => {
    it('should create a ValueObjectCertificate with a valid value', () => {
        const valueObject = new ValueObjectCertificate('certificate', 'ValidCertificate');
        expect(valueObject).toBeInstanceOf(ValueObjectCertificate);
        expect(valueObject.value).toBe('ValidCertificate');
    });

    it('should throw an error when value is null and nullable is false', () => {
        expect(() => new ValueObjectCertificate('certificate', null, false)).toThrow(
            'certificate: The value cannot be null'
        );
    });

    it('should not throw an error when value is null and nullable is true', () => {
        expect(() => new ValueObjectCertificate('certificate', null, true)).not.toThrow();
    });

    it('should throw an error when value is not a string', () => {
        expect(() => new ValueObjectCertificate('certificate', 123)).toThrow('certificate: The value must be a string');
    });
});
