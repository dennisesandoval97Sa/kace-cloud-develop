import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import axios from 'axios';
import { jest } from '@jest/globals';
import { AllowedConnection, KnexAllowedConnectionsRepository } from '../../../../src/allowed-conections';
import { AxiosHttpClient } from '../../../../src/shared/infrastructure/http/AxiosHttpClient';
import { InfrastructureError } from '../../../../src/shared/errors/InfrastructureError';
import AllowedConnectionsMother from '../../../allowed-conections/domain/AllowedConnectionsMother';
import { knexConfig } from '../../../knexfile';

// Pruebas de integracion REAL (sin mocks de axios) contra un servidor HTTPS local con
// certificado autofirmado generado en runtime. Prueban que el fallback TLS y el pinning
// por huella funcionan con la version de axios instalada. El cert/llave NUNCA se versionan.
describe('AxiosHttpClient - TLS behavior against a real local HTTPS server', () => {
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const client = new AxiosHttpClient(allowedConnectionRepository);

    let tmpDir;
    let cert;
    let fingerprint;
    let server;
    let port;
    let hits;
    let destroyOnRequest;
    let originalCaCertificates;
    let axiosRequestSpy;

    const saveUnpinnedConnection = () =>
        allowedConnectionRepository.save(
            AllowedConnection.create(AllowedConnectionsMother.dto({ connection: `localhost:${port}` }))
        );

    const savePinnedConnection = (certificate) =>
        allowedConnectionRepository.save(
            AllowedConnection.create({
                ...AllowedConnectionsMother.dto({ connection: `localhost:${port}`, certificate }),
                has_ssl: true,
            })
        );

    const url = () => `https://localhost:${port}/ping`;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kace-tls-'));
        const keyPath = path.join(tmpDir, 'key.pem');
        const certPath = path.join(tmpDir, 'cert.pem');
        execFileSync(
            'openssl',
            [
                'req',
                '-x509',
                '-newkey',
                'rsa:2048',
                '-nodes',
                '-keyout',
                keyPath,
                '-out',
                certPath,
                '-days',
                '1',
                '-subj',
                '/CN=localhost',
                '-addext',
                'subjectAltName=DNS:localhost',
            ],
            { stdio: 'ignore' }
        );
        cert = fs.readFileSync(certPath, 'utf8');
        fingerprint = crypto.createHash('sha256').update(new crypto.X509Certificate(cert).raw).digest('hex');

        server = https.createServer({ key: fs.readFileSync(keyPath), cert }, (req, res) => {
            hits += 1;
            if (destroyOnRequest) {
                req.socket.destroy();
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        port = server.address().port;
        originalCaCertificates = tls.getCACertificates('default');
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        hits = 0;
        destroyOnRequest = false;
        // Llama al axios real: solo observa, no reemplaza la implementacion.
        axiosRequestSpy = jest.spyOn(axios, 'request');
    });

    afterEach(() => {
        axiosRequestSpy.mockRestore();
        tls.setDefaultCACertificates(originalCaCertificates);
    });

    it('falls back to an insecure retry when a non-pinned connection presents a self-signed certificate', async () => {
        await saveUnpinnedConnection();

        const response = await client.request({ method: 'GET', url: url(), timeout: 10000 });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ ok: true });
        // El handshake fallido del primer intento nunca llega al handler.
        expect(hits).toBe(1);
        expect(axiosRequestSpy).toHaveBeenCalledTimes(2);
        expect(axiosRequestSpy.mock.calls[0][0].httpsAgent.options.rejectUnauthorized).toBe(true);
        expect(axiosRequestSpy.mock.calls[1][0].httpsAgent.options.rejectUnauthorized).toBe(false);
    });

    it('succeeds on the first attempt without fallback when the pinned fingerprint matches', async () => {
        // El pinning se evalua DESPUES de la validacion de cadena, asi que el cert
        // autofirmado debe ser de confianza para que se llegue a comparar la huella.
        tls.setDefaultCACertificates([...originalCaCertificates, cert]);
        await savePinnedConnection(fingerprint);

        const response = await client.request({ method: 'GET', url: url(), timeout: 10000 });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ ok: true });
        expect(hits).toBe(1);
        expect(axiosRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects without insecure retry when the pinned fingerprint does not match', async () => {
        tls.setDefaultCACertificates([...originalCaCertificates, cert]);
        await savePinnedConnection('0'.repeat(64));

        const error = await client.request({ method: 'GET', url: url(), timeout: 10000 }).catch((e) => e);

        expect(error).toBeInstanceOf(InfrastructureError);
        expect(error.message).toContain('Certificate fingerprint mismatch.');
        expect(hits).toBe(0);
        expect(axiosRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('flags the failed insecure retry and keeps the first TLS error when the retry also fails', async () => {
        destroyOnRequest = true;
        await saveUnpinnedConnection();

        const error = await client.request({ method: 'GET', url: url(), timeout: 10000 }).catch((e) => e);

        expect(error).toBeInstanceOf(InfrastructureError);
        expect(error.message).toBe('Server did not respond');
        expect(axiosRequestSpy).toHaveBeenCalledTimes(2);
        // Los flags viven en el error original (cause) y no en la InfrastructureError.
        expect(error.cause.retryWithInsecureTls).toBe(true);
        expect(error.cause.firstAttemptError.code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
        expect(hits).toBe(1);
    });
});
