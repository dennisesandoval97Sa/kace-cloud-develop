import { existsSync, lstatSync, readlinkSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { activateDeployEnv, DEPLOY_ENV_BACKUP_NAME, restoreDeployEnv } from './swapDeployEnv.mjs';

function lstatSafe(filePath) {
    try {
        return lstatSync(filePath);
    } catch {
        return null;
    }
}

function realpathSafe(filePath) {
    try {
        return realpathSync(filePath);
    } catch {
        return path.resolve(filePath);
    }
}

/**
 * Activa el .env elegido como `<root>/.env` (symlink, vía swapDeployEnv) y deja el
 * `.env` original como estaba. Alguien puede restaurarlo a mano a mitad de ejecución
 * (`swapDeployEnv.mjs --restore`), así que restore() debe tolerar que el backup ya no exista.
 */
export function createEnvActivation(rootDir, envFile) {
    const envPath = path.join(rootDir, '.env');
    const stat = lstatSafe(envPath);
    const snapshot = !stat
        ? { kind: 'none' }
        : stat.isSymbolicLink()
          ? { kind: 'symlink', target: readlinkSync(envPath) }
          : { kind: 'file' };
    const sameFile = Boolean(stat) && realpathSafe(envPath) === realpathSafe(envFile);
    const staleBackup = existsSync(path.join(rootDir, DEPLOY_ENV_BACKUP_NAME));
    let active = false;

    return {
        sameFile,
        staleBackup,
        activate() {
            if (sameFile) {
                return;
            }
            activateDeployEnv(rootDir, envFile);
            active = true;
        },
        restore() {
            if (!active) {
                return;
            }
            restoreDeployEnv(rootDir);
            const current = lstatSafe(envPath);
            if (snapshot.kind === 'symlink') {
                if (current) {
                    unlinkSync(envPath);
                }
                symlinkSync(snapshot.target, envPath);
            } else if (snapshot.kind === 'none' && current?.isSymbolicLink()) {
                unlinkSync(envPath);
            }
            active = false;
        },
    };
}
