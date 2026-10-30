import { AllowedConnection, KnexAllowedConnectionsRepository } from '../../../../src/allowed-conections';
import { AxiosHttpClient } from '../../../../src/shared/infrastructure/http/AxiosHttpClient';
import { knexConfig } from '../../../knexfile';
import { InfrastructureError } from '../../../../src/shared/errors/InfrastructureError';
import AllowedConnectionsMother from '../../../allowed-conections/domain/AllowedConnectionsMother';
import { jest } from '@jest/globals';
import axios from 'axios';

describe('AxiosHttpClient - Integration Tests', () => {
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const client = new AxiosHttpClient(allowedConnectionRepository);

    beforeEach(async () => {
        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'jsonplaceholder.typicode.com',
        });
        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'httpbin.org',
        });
        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'insecure-website.com',
        });
        // AllowedConnectionsMother.dto() no propaga has_ssl: lo fija a false siempre.
        // Pasarle un certificado dejaba la entidad en un estado que AllowedConnection
        // rechaza ("certificate must be empty when HTTPS is disabled"), y como esto
        // vive en el beforeEach tumbaba todos los it del archivo. Se arma aqui la
        // combinacion coherente (has_ssl + certificado) sin pasar por la factoria.
        await allowedConnectionRepository.save(
            AllowedConnection.create({
                ...AllowedConnectionsMother.dto({
                    connection: 'fakestoreapi.com',
                    certificate: '935cfa443de0606124637bcc58e5e911fcb55453ceb3e354fa8c80f76b3ac14e',
                }),
                has_ssl: true,
            })
        );
    });

    // KACE-SKIP(decision-pendiente): pega de verdad contra jsonplaceholder.typicode.com,
    // una API publica de terceros. Con salida a internet depende de que ese servicio este
    // vivo; sin ella falla con ENOTFOUND/getaddrinfo. No hay ningun doble de axios aqui:
    // los mocks de tests/support/mocks/ no cubren HTTP saliente generico.
    it.skip('should make a successful GET request to a real API', async () => {
        const url = 'https://jsonplaceholder.typicode.com/posts';

        const response = await client.request({
            method: 'GET',
            url: url,
            timeout: 30000,
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.headers).toBeDefined();
    });

    // KACE-SKIP(decision-pendiente): pega de verdad contra httpbin.org, un servicio publico
    // de terceros. Con salida a internet depende de que siga en pie; sin ella falla con
    // ENOTFOUND/getaddrinfo. Sin doble de axios, y los mocks de tests/support/mocks/ no
    // cubren HTTP saliente generico.
    it.skip('should allow boolean query params during connection security validation', async () => {
        const url = 'https://httpbin.org/get?open=true';

        const response = await client.request({
            method: 'GET',
            url,
            timeout: 30000,
        });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.headers).toBeDefined();
    });

    it('should throw an error when the connection is not allowed by security rules', async () => {
        const url = 'https://some-disallowed-domain.com';

        try {
            await client.request({
                method: 'GET',
                url: url,
            });

            throw new Error('Expected request to fail');
        } catch (error) {
            expect(error).toBeInstanceOf(InfrastructureError);
            expect(error.message).toBe(`Request failed: Connection to domain ${url} is not allowed`);
        }
    });

    // KACE-SKIP(decision-pendiente): mide el timeout pidiendo httpbin.org/delay/5, o sea
    // que gasta 3 s reales de red contra un tercero. Con internet cuesta esos segundos;
    // sin el pasa por la razon equivocada (ENOTFOUND, no timeout). Los mocks de
    // tests/support/mocks/ no cubren HTTP saliente generico.
    it.skip('should handle timeout correctly', async () => {
        const url = 'https://httpbin.org/delay/5';

        try {
            await client.request({
                method: 'GET',
                url: url,
                timeout: 3000,
            });
        } catch (error) {
            expect(error).toBeInstanceOf(InfrastructureError);
            expect(error.message).toBe('Server did not respond');
        }
    });

    // KACE-SKIP(decision-pendiente): hace TLS real contra fakestoreapi.com y compara la
    // huella del certificado con una constante escrita en el beforeEach. Con internet se
    // rompera solo el dia que ese tercero rote el certificado; sin internet falla con
    // ENOTFOUND. Los mocks de tests/support/mocks/ no cubren HTTP saliente generico.
    it.skip('should successfully complete the request when server certificate fingerprint matches', async () => {
        const url = 'https://fakestoreapi.com/products/1';

        const response = await client.request({
            method: 'GET',
            url: url,
        });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.headers).toBeDefined();
    });

    // KACE-SKIP(decision-pendiente): tambien hace TLS real contra fakestoreapi.com, aqui
    // para provocar el desajuste de huella. Con internet depende de ese tercero; sin el
    // el catch se traga un ENOTFOUND y el assert no comprueba lo que dice. Los mocks de
    // tests/support/mocks/ no cubren HTTP saliente generico.
    it.skip('should throw an error if server certificate fingerprint mismatch occurs', async () => {
        await allowedConnectionRepository
            .connection(allowedConnectionRepository.tableName)
            .update({ has_ssl: true, certificate: 'invalidcertificate' })
            .where('connection', 'fakestoreapi.com');

        const url = 'https://fakestoreapi.com/products/1';
        try {
            await client.request({
                method: 'GET',
                url: url,
            });

            throw new Error('Expected certificate mismatch error');
        } catch (error) {
            expect(error.message).toContain('Certificate fingerprint mismatch');
        }
    });

    // KACE-SKIP(decision-pendiente): pide http://insecure-website.com, un dominio de
    // terceros que ni siquiera controlamos. Con internet depende de lo que sirva ese
    // dominio hoy; sin internet falla con ENOTFOUND. Los mocks de tests/support/mocks/
    // no cubren HTTP saliente generico.
    it.skip('should make a successful request to an insecure site without a valid certificate', async () => {
        const url = 'http://insecure-website.com';

        try {
            const response = await client.request({
                method: 'GET',
                url: url,
            });

            expect(response.status).toBe(200);
            expect(response.data).toBeDefined();
            expect(response.headers).toBeDefined();
        } catch (error) {
            throw new Error('Request failed to insecure site: ' + error.message);
        }
    });

    it('should retry and return endpoint response when certificate chain cannot be verified', async () => {
        const url = 'https://jsonplaceholder.typicode.com/posts';
        const expectedResponse = {
            status: 200,
            data: [{ id: 1, title: 'Retried post' }],
            headers: { 'content-type': 'application/json' },
        };

        const axiosSpy = jest
            .spyOn(axios, 'request')
            .mockRejectedValueOnce({
                request: {},
                message: 'unable to verify the first certificate',
                code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            })
            .mockResolvedValueOnce(expectedResponse);

        const response = await client.request({
            method: 'GET',
            url,
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual([{ id: 1, title: 'Retried post' }]);
        expect(response.headers).toBeDefined();
        expect(axiosSpy).toHaveBeenCalledTimes(2);

        axiosSpy.mockRestore();
    });

    it('should successfully complete a request that takes more than 30 milliseconds', async () => {
        const url = 'https://jsonplaceholder.typicode.com/posts';

        const originalRequest = client.request;
        client.request = jest.fn().mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));

            return {
                status: 200,
                data: [{ id: 1, title: 'Test post' }],
                headers: { 'content-type': 'application/json' },
            };
        });

        const startTime = Date.now();

        const response = await client.request({
            method: 'GET',
            url: url,
            timeout: 5000,
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(duration).toBeGreaterThan(30);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.headers).toBeDefined();
        expect(client.request).toHaveBeenCalledWith({
            method: 'GET',
            url: url,
            timeout: 5000,
        });

        client.request = originalRequest;
    });
});
