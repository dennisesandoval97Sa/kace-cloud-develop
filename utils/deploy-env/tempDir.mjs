import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function withTempDir(fn) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-'));
    try {
        return await fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
