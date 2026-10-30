const http = require('http');

module.exports = async () => {
    const host = process.env.SCHEMAS_TEST_HOST || '127.0.0.1';
    const port = process.env.SCHEMAS_TEST_PORT || '60095';
    const ok = await new Promise((resolve) => {
        const req = http.request(
            {
                host,
                port,
                path: '/',
                method: 'GET',
                timeout: 2500,
            },
            (res) => {
                res.resume();
                resolve(true);
            }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
    process.env.SCHEMAS_API_REACHABLE = ok ? '1' : '0';
};
