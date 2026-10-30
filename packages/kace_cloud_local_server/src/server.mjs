import dotenv from 'dotenv';
import path from 'node:path';

// Load .env from monorepo root BEFORE any other imports
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

// Force local mode so withTenantContext uses LocalTenantRepository
process.env.NODE_ENV = 'local';

import express from 'express';
import cors from 'cors';
import { registerAllRoutes } from './route-registry.mjs';

const app = express();
const PORT = process.env.LOCAL_SERVER_PORT || 3000;

// ─── Middleware ───────────────────────────────────────────

app.use(
    cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Tenant-Id',
            'X-Client-Fingerprint',
            'X-Api-Key',
            'X-Amz-Date',
            'X-Amz-Security-Token',
            'X-Amz-User-Agent',
            'User-Agent',
            'X-Public-Key',
        ],
    })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
        const reset = '\x1b[0m';
        console.log(`${color}${req.method} ${req.path} -> ${status}${reset} (${duration}ms)`);
    });
    next();
});

// ─── Health Check ────────────────────────────────────────

app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: 'local', nodeEnv: process.env.NODE_ENV });
});

// ─── Register All Lambda Routes ──────────────────────────

console.log('\nKACE Local Dev Server');
console.log('='.repeat(50));
console.log('Discovering and loading microservices...\n');

const startTime = Date.now();
const { serviceCount, routeCount, skipped } = await registerAllRoutes(app);
const loadTime = Date.now() - startTime;

console.log(`\n${'='.repeat(50)}`);
console.log(`Loaded: ${serviceCount} services, ${routeCount} routes (${loadTime}ms)`);

if (skipped.length > 0) {
    console.log(`\nSkipped (${skipped.length}):`);
    for (const reason of skipped) {
        console.log(`  - ${reason}`);
    }
}

// ─── 404 Handler ─────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({
        error: true,
        message: `No route found: ${req.method} ${req.path}`,
    });
});

// ─── Error Handler ───────────────────────────────────────

app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: true,
        message: 'Internal server error',
        details: err.message,
    });
});

// ─── Start Server ────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`Debug: use --inspect or --inspect-brk\n`);
});
