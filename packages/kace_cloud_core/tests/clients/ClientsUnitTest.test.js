import { Client, ClientResponse, ValueObjectPhone } from '../../src/clients';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectUuid, ValueObjectInt, ValidationFailError, InvalidArgumentError } from '../../src/shared';
import ClientMother from './domain/ClientMother';
import { VONombreEmpresa } from '../../src/clients/domain/valueObjects/VONombreEmpresa.js';
import { ValueObjectClientName } from '../../src/clients/domain/valueObjects/ValueObjectClientName.js';

describe('Client Entity', () => {
    const dto = ClientMother.dto();

    it('should create a client with valid data', () => {
        const client = Client.create(dto);
        expect(client.id).toBeInstanceOf(ValueObjectUuid);
        expect(client.status).toBeInstanceOf(ValueObjectInt);
    });

    it('defaults relations to an empty object and keeps the joined rows it is built with', () => {
        expect(Client.create(dto).relations.value).toEqual({});

        const auxRow = { id: uuidv4(), cliente_id: dto.id, data: { ciudad: 'Medellin' } };
        const withRelations = Client.create({ ...dto, relations: { aux_clients: auxRow } });

        expect(withRelations.relations.value).toEqual({ aux_clients: auxRow });
        // `relations` no es una columna de `clients`: no puede ensuciar un UPDATE...
        expect(withRelations.changedAttributes).toEqual({});
        // ...ni los snapshots que `saveHistory` arma con `toJson()`.
        expect(withRelations.toJson()).not.toHaveProperty('relations');
    });

    it('should update client data', () => {
        const client = Client.create(dto);
        const newData = {
            nombres: 'Pepe',
            campos_extra1: 'New Campo Extra',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        client.update(newData);
        expect(client.changedAttributes).toEqual(newData);
    });

    it('should create a client without an email', () => {
        const clientWithoutEmail = { ...dto, email: undefined };
        const client = Client.create(clientWithoutEmail);

        expect(client).toBeInstanceOf(Client);
        expect(client.id).toBeInstanceOf(ValueObjectUuid);
        expect(client.status).toBeInstanceOf(ValueObjectInt);
        expect(client.email.value).toBeUndefined();
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => Client.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('should allow setting all nullable fields to null', () => {
        const client = Client.create(dto);

        const nullableFields = [
            'nombres',
            'apellido1',
            'apellido2',
            'nombre_empresa',
            'email',
            'email_alterno',
            'telefono',
            'telefono_alterno',
            'sexo',
            'estado_civil',
            'fecha_nacimiento',
            'campos_extra1',
            'campos_extra2',
            'campos_extra3',
            'padre_id',
        ];

        nullableFields.forEach((field) => {
            client[field] = null;
            expect(client[field].value).toBe(null);
        });
    });
    // TODO: faltan tests
});

describe('ValueObjectClientName', () => {
    const validName = 'Juan Pérez #ONE (VIP)';

    it('should create a valid ValueObjectClientName', () => {
        const clientName = new ValueObjectClientName('clientName', validName);
        expect(clientName.value).toBe(validName);
    });

    it('should throw error if value is null and nullable is false', () => {
        expect(() => {
            new ValueObjectClientName('clientName', null, false);
        }).toThrow('clientName: The value cannot be null');
    });

    it('should allow null value if nullable is true', () => {
        const clientName = new ValueObjectClientName('clientName', null, true);
        expect(clientName.value).toBe(null);
    });

    it('should throw error if value is shorter than 3 characters', () => {
        expect(() => {
            new ValueObjectClientName('clientName', 'AB');
        }).toThrow('clientName: The value must be at least 3 characters long');
    });

    it('should throw error if value is longer than 300 characters', () => {
        const longName = 'A'.repeat(301);
        expect(() => {
            new ValueObjectClientName('clientName', longName);
        }).toThrow('clientName: The value must be at most 300 characters long');
    });

    it('should throw error if value contains disallowed characters (e.g. | or $)', () => {
        expect(() => {
            new ValueObjectClientName('clientName', 'Nombre con símbolo inválido |');
        }).toThrow(
            'clientName: The name must contain only letters, numbers, and the following symbols: ( ) & % , . - / ; : @ # _ ~ ‘ “ ‰'
        );

        expect(() => {
            new ValueObjectClientName('clientName', 'Nombre con símbolo inválido $');
        }).toThrow(InvalidArgumentError);
    });

    it('should allow permitted symbols only', () => {
        const valid = 'Cliente Premium (ONE) # & % , . - / ; : @ _ ~ ‘ “ ‰';
        const clientName = new ValueObjectClientName('clientName', valid);
        expect(clientName.value).toBe(valid);
    });
});

describe('VONombreEmpresa', () => {
    const validString = 'Empresa 1 (Oficial)';

    it('should create a valid VONombreEmpresa', () => {
        const valueObject = new VONombreEmpresa('name', validString);
        expect(valueObject.value).toBe(validString);
    });

    it('should throw error if value is null and nullable is false', () => {
        expect(() => {
            new VONombreEmpresa('name', null, false);
        }).toThrow(Error);
    });

    it('should allow null value if nullable is true', () => {
        const valueObject = new VONombreEmpresa('name', null, true);
        expect(valueObject.value).toBe(null);
    });

    it('should throw error if value is shorter than 3 characters', () => {
        expect(() => {
            new VONombreEmpresa('name', 'AB');
        }).toThrow(new ValidationFailError('name: The value must be at least 3 characters long'));
    });

    it('should throw error if value is longer than 100 characters', () => {
        const longString = 'A'.repeat(101);
        expect(() => {
            new VONombreEmpresa('name', longString);
        }).toThrow('name: The value must be at most 100 characters long');
    });

    it('should throw error if value contains disallowed characters', () => {
        expect(() => {
            new VONombreEmpresa('name', 'Empresa con símbolo inválido @');
        }).toThrow(
            'name: The name must contain only letters, numbers and some symbols:  Empresa con símbolo inválido @'
        );
    });

    it('should allow numbers and permitted symbols', () => {
        const value = 'Empresa 123 - S.A. Perú (100) & . , - /  | ( ) ; + ~';
        const vo = new VONombreEmpresa('name', value);
        expect(vo.value).toBe(value);
    });
});

describe('ValueObjectPhone', () => {
    const field = 'phone';

    it('should accept a valid phone number with "+" at the beginning', () => {
        const phone = new ValueObjectPhone(field, '+1234567890', false);
        expect(phone.value).toBe('+1234567890');
    });

    it('should accept a valid phone number without "+"', () => {
        const phone = new ValueObjectPhone(field, '1234567890', false);
        expect(phone.value).toBe('1234567890');
    });

    it('should throw error if phone number contains letters', () => {
        expect(() => {
            new ValueObjectPhone(field, '123ABC456', false);
        }).toThrow(`${field}: The phone number must contain only digits and an optional '+' at the beginning.`);
    });

    it('should throw error if "+" is in the middle', () => {
        expect(() => {
            new ValueObjectPhone(field, '123+456789', false);
        }).toThrow(`${field}: The phone number must contain only digits and an optional '+' at the beginning.`);
    });

    it('should throw error if "+" appears more than once', () => {
        expect(() => {
            new ValueObjectPhone(field, '++123456', false);
        }).toThrow(`${field}: The phone number must contain only digits and an optional '+' at the beginning.`);
    });

    it('should throw error if value exceeds 15 characters', () => {
        expect(() => {
            new ValueObjectPhone(field, '+1234567890123456', false);
        }).toThrow(`${field}: The value must be at most 15 characters long`);
    });

    it('should throw error if value is null and nullable is false', () => {
        expect(() => {
            new ValueObjectPhone(field, null, false);
        }).toThrow(`${field}: The value cannot be null`);
    });

    it('should allow null if nullable is true', () => {
        const phone = new ValueObjectPhone(field, null, true);
        expect(phone.value).toBe(null);
    });
});

describe('ClientResponse', () => {
    const dto = ClientMother.dto();

    it('omits relations property when client has no relations', () => {
        const client = Client.create(dto);
        const response = new ClientResponse(client);
        const json = response.toJson();

        expect(json.data).not.toHaveProperty('relations');
        expect(json.data.id).toBe(client.id.value);
        expect(json.data.documento).toBe(client.documento.value);
    });

    it('includes relations property when client has relations populated', () => {
        const auxRow = { id: uuidv4(), cliente_id: dto.id, data: { ciudad: 'Bogota' } };
        const client = Client.create({ ...dto, relations: { aux_clients: auxRow } });
        const response = new ClientResponse(client);
        const json = response.toJson();

        expect(json.data).toHaveProperty('relations');
        expect(json.data.relations).toEqual({ aux_clients: auxRow });
    });
});
