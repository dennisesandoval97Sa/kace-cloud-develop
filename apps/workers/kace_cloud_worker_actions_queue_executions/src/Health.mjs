import http from 'node:http';

export class Health {
    #port;
    #server;

    constructor({ port = 8080 } = {}) {
        this.#port = port;
    }

    /**
     * Starts the HTTP server.
     * @param {() => boolean} healthy - Reporter returning whether the worker is healthy.
     * @returns {Promise<number>} The actual port the server is listening on.
     */
    async start(healthy) {
        if (typeof healthy !== 'function') {
            throw new Error('healthy reporter must be a function');
        }
        this.#server = http.createServer((req, res) => {
            if (req.url === '/health') {
                const ok = healthy();
                res.statusCode = ok ? 200 : 503;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ status: ok ? 'ok' : 'draining' }));
                return;
            }
            res.statusCode = 404;
            res.end();
        });
        await new Promise((resolve) => this.#server.listen(this.#port, resolve));
        return this.#server.address().port;
    }

    async stop() {
        if (!this.#server) return;
        await new Promise((resolve) => this.#server.close(resolve));
        this.#server = null;
    }
}
