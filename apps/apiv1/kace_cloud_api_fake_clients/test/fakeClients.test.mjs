import { handler } from '../src/handler.mjs';
import { eventBase } from './eventBase.mjs';
import crypto from 'crypto';

describe('FakeClients Controller (via handler)', () => {
    const EXISTING_ID = crypto.randomUUID();
    const clientId = crypto.randomUUID();

    it('should create a new fake client successfully', async () => {
        const newId = EXISTING_ID;

        const event = eventBase({
            operation: 'CREATE',
            body: {
                id: newId,
                nombres: 'Nuevo',
                apellido1: 'Cliente',
                tipo_documento: 'CC',
            },
        });

        const response = await handler(event);

        expect([201, 200]).toContain(response.statusCode);
    });

    it('should update a fake client with valid data', async () => {
        const event = eventBase({
            operation: 'UPDATE',
            id: EXISTING_ID,
            body: {
                nombres: 'NombreActualizado',
                apellido1: 'ApellidoActualizado',
                tipo_documento: 'CC',
            },
        });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('Success');
    });

    it('should return 400 when updating a client with invalid ID format', async () => {
        const event = eventBase({
            operation: 'UPDATE',
            id: 'invalid-id',
            body: {
                nombres: 'Nombre',
                apellido1: 'Apellido',
                tipo_documento: 'CC',
            },
        });

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Invalid id');
    });

    it('should retrieve a fake client by ID', async () => {
        const event = eventBase({
            operation: 'GET',
            id: EXISTING_ID,
        });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
    });

    it('should create a NIT client and then update name', async () => {
        const createEvent = eventBase({
            operation: 'CREATE',
            body: {
                id: clientId,
                habeas_data: 'SI',
                status: 1,
                tipo_documento: 'NIT',
                tipo_cliente: 'Comercial',
            },
        });

        const createResponse = await handler(createEvent);
        expect([200, 201]).toContain(createResponse.statusCode);

        const updateEvent = eventBase({
            operation: 'CREATE',
            body: {
                id: clientId,
                tipo_documento: 'CC',
                nombres: 'Juan',
                apellido1: 'Perez',
                apellido2: 'Gomez',
                nombre_empresa: null,
            },
        });

        const updateResponse = await handler(updateEvent);
        expect([200, 201]).toContain(updateResponse.statusCode);

        const readEvent2 = eventBase({
            operation: 'GET',
            id: clientId,
        });

        const readResponse2 = await handler(readEvent2);
        expect(readResponse2.statusCode).toBe(200);

        const { data: updatedData } = JSON.parse(readResponse2.body);

        expect(updatedData.tipo_documento).toBe('CC');
        expect(updatedData.nombres).toBe('Juan');
        expect(updatedData.apellido1).toBe('Perez');
        expect(updatedData.apellido2).toBe('Gomez');
        expect(updatedData.nombre_empresa).toBeNull();
    });

    it('should create a client with NIT and tipo_cliente Natural, then update the client data with company name', async () => {
        const clientId = crypto.randomUUID();

        const createEvent = eventBase({
            operation: 'CREATE',
            body: {
                id: clientId,
                habeas_data: 'SI',
                status: 1,
                tipo_documento: 'NIT',
                tipo_cliente: 'Natural',
            },
        });

        const createResponse = await handler(createEvent);
        expect([200, 201]).toContain(createResponse.statusCode);

        const updateEvent = eventBase({
            operation: 'CREATE',
            body: {
                id: clientId,
                tipo_documento: 'NIT',
                nombre_empresa: 'Nueva empresa',
            },
        });

        const response = await handler(updateEvent);

        const updateResponse = JSON.parse(response.body);

        expect(updateResponse.message).toBe('Success');
        expect(response.statusCode).toBe(200);
    });
});
