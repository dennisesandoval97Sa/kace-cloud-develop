import http from 'node:http';
import { Health } from '../src/Health.mjs';

const httpGet = (port, path) =>
    new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end();
    });

describe('Health', () => {
    let sut;
    afterEach(async () => {
        if (sut) {
            await sut.stop();
            sut = null;
        }
    });

    it('returns 200 on /health when healthy', async () => {
        sut = new Health({ port: 0 });
        const port = await sut.start(() => true);

        const res = await httpGet(port, '/health');

        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });

    it('returns 503 when reporter returns false', async () => {
        sut = new Health({ port: 0 });
        const port = await sut.start(() => false);

        const res = await httpGet(port, '/health');

        expect(res.status).toBe(503);
        expect(JSON.parse(res.body)).toEqual({ status: 'draining' });
    });

    it('returns 404 on unknown paths', async () => {
        sut = new Health({ port: 0 });
        const port = await sut.start(() => true);

        const res = await httpGet(port, '/other');

        expect(res.status).toBe(404);
    });

    it('throws when reporter is not a function', async () => {
        sut = new Health({ port: 0 });

        await expect(sut.start('not-a-function')).rejects.toThrow(/function/);
    });

    it('stop is idempotent (no-op if not started)', async () => {
        const sut2 = new Health({ port: 0 });
        await expect(sut2.stop()).resolves.toBeUndefined();
    });

    it('uses default options when constructed with no args', async () => {
        const sut2 = new Health();
        await expect(sut2.stop()).resolves.toBeUndefined();
    });
});
