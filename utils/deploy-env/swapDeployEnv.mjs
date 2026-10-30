import { copyFileSync, existsSync, lstatSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { stdout, stderr } from 'node:process';
import { pathToFileURL } from 'node:url';

export const DEPLOY_ENV_BACKUP_NAME = '.env.deploy-backup';

function existsLinkOrFile(filePath) {
    try {
        lstatSync(filePath);
        return true;
    } catch {
        return false;
    }
}

function isSymlink(filePath) {
    try {
        return lstatSync(filePath).isSymbolicLink();
    } catch {
        return false;
    }
}

export function activateDeployEnv(root, sourceFile) {
    const envPath = path.join(root, '.env');
    const backupPath = path.join(root, DEPLOY_ENV_BACKUP_NAME);
    const absSource = path.resolve(sourceFile);

    if (!existsSync(backupPath) && existsLinkOrFile(envPath) && !isSymlink(envPath)) {
        copyFileSync(envPath, backupPath);
    }

    if (existsLinkOrFile(envPath)) {
        unlinkSync(envPath);
    }
    symlinkSync(absSource, envPath);

    return {
        envPath,
        backupPath,
        hadEnv: existsSync(backupPath),
        linked: absSource,
    };
}

export function restoreDeployEnv(root, backup) {
    const envPath = backup?.envPath || path.join(root, '.env');
    const backupPath = backup?.backupPath || path.join(root, DEPLOY_ENV_BACKUP_NAME);
    const hasBackup = existsSync(backupPath) && !isSymlink(backupPath);
    if (!hasBackup) {
        return;
    }

    if (existsLinkOrFile(envPath)) {
        unlinkSync(envPath);
    }
    copyFileSync(backupPath, envPath);
    rmSync(backupPath);
}

function argValue(argv, flag) {
    const index = argv.indexOf(flag);
    if (index === -1) {
        return '';
    }
    return argv[index + 1] ?? '';
}

export async function main(argv = process.argv.slice(2)) {
    const root = argValue(argv, '--root') || process.cwd();
    if (argv.includes('--activate')) {
        const source = argValue(argv, '--activate');
        if (!source) {
            throw new Error('Falta la ruta del dotenv a activar.');
        }
        const backup = activateDeployEnv(root, source);
        stderr.write(`Copia de seguridad del .env original: ${backup.backupPath}\n`);
        stdout.write(`${JSON.stringify(backup)}\n`);
        return;
    }
    if (argv.includes('--restore') || argv.includes('--recover')) {
        restoreDeployEnv(root);
        return;
    }
    throw new Error('Usa --activate <archivo> o --restore.');
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked === import.meta.url) {
    await main().catch((error) => {
        stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
