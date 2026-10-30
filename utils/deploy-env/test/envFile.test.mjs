import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AUTO_BLOCK_HEADER, formatChanges, maskValue, parseEnv, planEnvUpdates, writeEnvUpdates } from '../envFile.mjs';

describe('parseEnv', () => {
    it('toma la última definición, admite export, comillas y comentarios en línea', () => {
        // Arrange
        const text = [
            '# comentario',
            'A=1',
            'A=2',
            'export B="con espacios"',
            "C='simple'",
            'D=valor # nota',
            'E=a#b',
            'F=',
        ].join('\n');

        // Act
        const env = parseEnv(text);

        // Assert
        assert.deepEqual(env, { A: '2', B: 'con espacios', C: 'simple', D: 'valor', E: 'a#b', F: '' });
    });
});

describe('planEnvUpdates', () => {
    it('solo toca las claves pedidas y conserva el resto byte a byte', () => {
        // Arrange
        const text = '# cabecera\nKEEP=x\nARN=viejo\n\n# otra\nOTHER=y\n';

        // Act
        const { text: next, changes } = planEnvUpdates(text, { ARN: 'nuevo' });

        // Assert
        assert.equal(next, '# cabecera\nKEEP=x\nARN=nuevo\n\n# otra\nOTHER=y\n');
        assert.deepEqual(changes, [{ key: 'ARN', status: 'CAMBIA', before: 'viejo', after: 'nuevo' }]);
    });

    it('reemplaza la última definición y conserva export, comillas y comentario', () => {
        // Arrange
        const text = 'ARN=primera\nexport ARN="segunda" # auto\n';

        // Act
        const { text: next } = planEnvUpdates(text, { ARN: 'tercera' });

        // Assert
        assert.equal(next, 'ARN=primera\nexport ARN="tercera" # auto\n');
    });

    it('marca NUEVA una clave vacía e IGUAL una que ya coincide', () => {
        // Arrange
        const text = 'VACIA=\nIGUAL=ok\n';

        // Act
        const { text: next, changes } = planEnvUpdates(text, { VACIA: 'v', IGUAL: 'ok' });

        // Assert
        assert.equal(next, 'VACIA=v\nIGUAL=ok\n');
        assert.deepEqual(
            changes.map((change) => change.status),
            ['NUEVA', 'IGUAL']
        );
    });

    it('añade las claves ausentes en un bloque auto al final, una sola cabecera', () => {
        // Arrange
        const text = 'A=1\n';

        // Act
        const first = planEnvUpdates(text, { NUEVA1: 'x' });
        const second = planEnvUpdates(first.text, { NUEVA2: 'y' });

        // Assert
        assert.equal(first.text, `A=1\n\n${AUTO_BLOCK_HEADER}\nNUEVA1=x\n`);
        assert.equal(second.text, `A=1\n\n${AUTO_BLOCK_HEADER}\nNUEVA1=x\nNUEVA2=y\n`);
        assert.equal(first.changes[0].status, 'NUEVA');
    });

    it('conserva CRLF', () => {
        // Arrange
        const text = 'A=1\r\nB=2\r\n';

        // Act
        const { text: next } = planEnvUpdates(text, { B: '3' });

        // Assert
        assert.equal(next, 'A=1\r\nB=3\r\n');
    });
});

describe('writeEnvUpdates', () => {
    function tempEnv(text) {
        const dir = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-envfile-'));
        const file = path.join(dir, '.env.test');
        writeFileSync(file, text);
        return { dir, file };
    }
    const now = new Date(2026, 8, 29, 10, 5, 7);

    it('escribe y crea un único .bak con timestamp en la primera escritura', () => {
        // Arrange
        const { dir, file } = tempEnv('A=1\n');
        const backupState = { done: false, path: '' };

        // Act
        writeEnvUpdates(file, { A: '2' }, { dryRun: false, backupState, now });
        writeEnvUpdates(file, { A: '3' }, { dryRun: false, backupState, now });

        // Assert
        assert.equal(readFileSync(file, 'utf8'), 'A=3\n');
        assert.equal(backupState.path, `${file}.bak-20260929100507`);
        assert.equal(readFileSync(backupState.path, 'utf8'), 'A=1\n');
        assert.equal(readdirSync(dir).filter((name) => name.includes('.bak-')).length, 1);
    });

    it('en dry-run no escribe ni crea .bak pero devuelve los cambios', () => {
        // Arrange
        const { dir, file } = tempEnv('A=1\n');
        const backupState = { done: false, path: '' };

        // Act
        const changes = writeEnvUpdates(file, { A: '2' }, { dryRun: true, backupState, now });

        // Assert
        assert.equal(readFileSync(file, 'utf8'), 'A=1\n');
        assert.equal(backupState.done, false);
        assert.equal(readdirSync(dir).length, 1);
        assert.equal(changes[0].status, 'CAMBIA');
    });

    it('no crea .bak si todo está IGUAL', () => {
        // Arrange
        const { file } = tempEnv('A=1\n');
        const backupState = { done: false, path: '' };

        // Act
        writeEnvUpdates(file, { A: '1' }, { dryRun: false, backupState, now });

        // Assert
        assert.equal(backupState.done, false);
        assert.equal(existsSync(`${file}.bak-20260929100507`), false);
    });
});

describe('maskValue / formatChanges', () => {
    it('enmascara dejando 4+4 caracteres y oculta del todo los cortos', () => {
        assert.equal(maskValue('arn:aws:sqs:us-east-1:123:cola'), 'arn:…cola');
        assert.equal(maskValue('corto'), '****');
        assert.equal(maskValue(''), '(vacía)');
    });

    it('lista NUEVA y CAMBIA enmascaradas y resume cuando todo está al día', () => {
        // Arrange
        const changes = [
            { key: 'A_ARN', status: 'NUEVA', before: '', after: 'arn:aws:sqs:x:1:uno' },
            { key: 'B_URL', status: 'CAMBIA', before: 'https://sqs/viejo-valor', after: 'https://sqs/nuevo-valor' },
            { key: 'C', status: 'IGUAL', before: 'x', after: 'x' },
        ];

        // Act
        const lines = formatChanges(changes);
        const quiet = formatChanges([{ key: 'C', status: 'IGUAL', before: 'x', after: 'x' }]);

        // Assert
        assert.deepEqual(lines, [
            '  NUEVA   A_ARN = arn:…:uno',
            '  CAMBIA  B_URL: http…alor → http…alor  (¿el .env apuntaba a otra cuenta?)',
        ]);
        assert.deepEqual(quiet, ['  .env al día (1 clave(s) sin cambios)']);
    });
});
