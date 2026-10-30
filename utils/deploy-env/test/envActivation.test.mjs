import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEnvActivation } from '../envActivation.mjs';
import { restoreDeployEnv } from '../swapDeployEnv.mjs';

function repo() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-act-'));
    const target = path.join(root, '.env.natura');
    writeFileSync(target, 'TARGET=1\n');
    return { root, target, envPath: path.join(root, '.env') };
}

describe('createEnvActivation', () => {
    it('con un .env fichero: activa como symlink y restaura el fichero original', () => {
        // Arrange
        const { root, target, envPath } = repo();
        writeFileSync(envPath, 'ORIGINAL=1\n');
        const activation = createEnvActivation(root, target);

        // Act
        activation.activate();
        const linked = readlinkSync(envPath);
        activation.restore();

        // Assert
        assert.equal(linked, target);
        assert.equal(lstatSync(envPath).isSymbolicLink(), false);
        assert.equal(readFileSync(envPath, 'utf8'), 'ORIGINAL=1\n');
        assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
    });

    it('sin .env previo: restore elimina el symlink', () => {
        // Arrange
        const { root, target, envPath } = repo();
        const activation = createEnvActivation(root, target);

        // Act
        activation.activate();
        activation.restore();

        // Assert
        assert.equal(existsSync(envPath), false);
    });

    it('con .env symlink previo: restore lo vuelve a apuntar a su destino original', () => {
        // Arrange
        const { root, target, envPath } = repo();
        const other = path.join(root, '.env.sara');
        writeFileSync(other, 'SARA=1\n');
        symlinkSync(other, envPath);
        const activation = createEnvActivation(root, target);

        // Act
        activation.activate();
        activation.restore();

        // Assert
        assert.equal(readlinkSync(envPath), other);
    });

    it('si el archivo elegido ES el .env activo, activate/restore no hacen nada', () => {
        // Arrange
        const { root, envPath } = repo();
        writeFileSync(envPath, 'ORIGINAL=1\n');
        const activation = createEnvActivation(root, envPath);

        // Act
        activation.activate();
        activation.restore();

        // Assert
        assert.equal(activation.sameFile, true);
        assert.equal(lstatSync(envPath).isSymbolicLink(), false);
        assert.equal(readFileSync(envPath, 'utf8'), 'ORIGINAL=1\n');
    });

    it('detecta un .env.deploy-backup huérfano', () => {
        // Arrange
        const { root, target } = repo();
        writeFileSync(path.join(root, '.env.deploy-backup'), 'VIEJO=1\n');

        // Act
        const activation = createEnvActivation(root, target);

        // Assert
        assert.equal(activation.staleBackup, true);
    });

    it('restore sin activate previo no toca nada', () => {
        // Arrange
        const { root, target, envPath } = repo();
        writeFileSync(envPath, 'ORIGINAL=1\n');
        const activation = createEnvActivation(root, target);

        // Act
        activation.restore();

        // Assert
        assert.equal(readFileSync(envPath, 'utf8'), 'ORIGINAL=1\n');
    });

    // Un restore externo (`swapDeployEnv.mjs --restore` lanzado a mano a mitad de ejecución)
    // ocurre de forma independiente al restore() del orquestador. Estos tests fijan esa
    // interleaving:
    //   a) activate → restoreDeployEnv(root) [restore externo] → restore() [orquestador]
    //   b) activate → activate (segunda fase needsActiveEnv) → restoreDeployEnv(root) [externo] → restore()
    describe('interleaving con un restore externo (swapDeployEnv --restore)', () => {
        it('secuencia (a), .env original era un fichero: el resultado final es el fichero original intacto', () => {
            // Arrange
            const { root, target, envPath } = repo();
            writeFileSync(envPath, 'ORIGINAL=1\n');
            const activation = createEnvActivation(root, target);

            // Act
            activation.activate();
            restoreDeployEnv(root); // restore externo
            activation.restore();

            // Assert
            assert.equal(lstatSync(envPath).isSymbolicLink(), false);
            assert.equal(readFileSync(envPath, 'utf8'), 'ORIGINAL=1\n');
            assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
        });

        it('secuencia (a), .env original era un symlink: el resultado final es el symlink original intacto', () => {
            // Arrange
            const { root, target, envPath } = repo();
            const other = path.join(root, '.env.sara');
            writeFileSync(other, 'SARA=1\n');
            symlinkSync(other, envPath);
            const activation = createEnvActivation(root, target);

            // Act
            activation.activate();
            restoreDeployEnv(root); // restore externo
            activation.restore();

            // Assert
            assert.equal(lstatSync(envPath).isSymbolicLink(), true);
            assert.equal(readlinkSync(envPath), other);
            assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
        });

        it('secuencia (a), sin .env previo: el resultado final es la ausencia del archivo', () => {
            // Arrange
            const { root, target, envPath } = repo();
            const activation = createEnvActivation(root, target);

            // Act
            activation.activate();
            restoreDeployEnv(root); // restore externo
            activation.restore();

            // Assert
            assert.equal(existsSync(envPath), false);
            assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
        });

        it('secuencia (b), .env original era un fichero: activate de una segunda fase no rompe la restauración final', () => {
            // Arrange
            const { root, target, envPath } = repo();
            writeFileSync(envPath, 'ORIGINAL=1\n');
            const activation = createEnvActivation(root, target);

            // Act
            activation.activate();
            activation.activate(); // segunda fase needsActiveEnv
            restoreDeployEnv(root); // restore externo
            activation.restore();

            // Assert
            assert.equal(lstatSync(envPath).isSymbolicLink(), false);
            assert.equal(readFileSync(envPath, 'utf8'), 'ORIGINAL=1\n');
            assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
        });

        it('secuencia (b), .env original era un symlink: activate de una segunda fase no rompe la restauración final', () => {
            // Arrange
            const { root, target, envPath } = repo();
            const other = path.join(root, '.env.sara');
            writeFileSync(other, 'SARA=1\n');
            symlinkSync(other, envPath);
            const activation = createEnvActivation(root, target);

            // Act
            activation.activate();
            activation.activate(); // segunda fase needsActiveEnv
            restoreDeployEnv(root); // restore externo
            activation.restore();

            // Assert
            assert.equal(lstatSync(envPath).isSymbolicLink(), true);
            assert.equal(readlinkSync(envPath), other);
            assert.equal(existsSync(path.join(root, '.env.deploy-backup')), false);
        });
    });
});
