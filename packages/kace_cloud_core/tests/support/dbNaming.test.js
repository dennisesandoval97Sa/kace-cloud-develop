import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    combineFingerprints,
    databaseNameForTestPath,
    migrationsFingerprint,
    payloadFingerprint,
    stableSerialize,
    templateDatabaseName,
} from './dbNaming.js';

const RUN_ID = 'aaaaaaaabbbb';
const WORKER_ID = '1';

describe('dbNaming', () => {
    it('deriva un nombre valido para postgres desde un testPath', () => {
        const name = databaseNameForTestPath(
            '/repo/packages/kace_cloud_core/tests/cases/CasesIntegration.test.js',
            RUN_ID,
            WORKER_ID
        );

        expect(name).toMatch(/^kace_t_[0-9a-z]{12}_[0-9a-f]{12}_w[0-9]+$/);
        expect(name.length).toBeLessThanOrEqual(63);
    });

    it('es determinista para la misma ruta', () => {
        const path = '/repo/tests/literals/LiteralIntegration.test.js';

        expect(databaseNameForTestPath(path, RUN_ID, WORKER_ID)).toBe(databaseNameForTestPath(path, RUN_ID, WORKER_ID));
    });

    it('produce nombres distintos para rutas distintas', () => {
        const a = databaseNameForTestPath('/repo/tests/literals/A.test.js', RUN_ID, WORKER_ID);
        const b = databaseNameForTestPath('/repo/tests/literals/B.test.js', RUN_ID, WORKER_ID);

        expect(a).not.toBe(b);
    });

    it('ignora el prefijo absoluto para que el nombre no dependa del checkout', () => {
        const a = databaseNameForTestPath(
            '/home/ana/repo/packages/kace_cloud_core/tests/literals/A.test.js',
            RUN_ID,
            WORKER_ID
        );
        const b = databaseNameForTestPath(
            '/srv/ci/build/packages/kace_cloud_core/tests/literals/A.test.js',
            RUN_ID,
            WORKER_ID
        );

        expect(a).toBe(b);
    });

    it('lanza si el testPath esta vacio', () => {
        expect(() => databaseNameForTestPath('', RUN_ID, WORKER_ID)).toThrow('testPath es obligatorio');
    });

    it('mete la identidad de corrida en el nombre, para que dos corridas no colisionen', () => {
        const path = '/repo/packages/kace_cloud_core/tests/cases/CasesIntegration.test.js';

        expect(databaseNameForTestPath(path, 'aaaaaaaabbbb', WORKER_ID)).not.toBe(
            databaseNameForTestPath(path, 'ccccccccdddd', WORKER_ID)
        );
    });

    it('el mismo archivo en la misma corrida y el mismo worker da siempre el mismo nombre', () => {
        const path = '/repo/packages/kace_cloud_core/tests/cases/CasesIntegration.test.js';

        expect(databaseNameForTestPath(path, 'aaaaaaaabbbb', '3')).toBe(
            databaseNameForTestPath(path, 'aaaaaaaabbbb', '3')
        );
    });

    // Es EL caso que motivo el tercer componente: los IDE repiten la ruta en
    // `--runTestsByPath` (una entrada por test fallido) y jest no la deduplica,
    // asi que el mismo archivo acaba corriendo a la vez en dos workers. Con la
    // clave (corrida, archivo) los dos se peleaban por la misma base de datos.
    it('el mismo archivo en dos workers distintos da nombres distintos', () => {
        const path = '/repo/packages/kace_cloud_core/tests/cases/CasesIntegration.test.js';

        expect(databaseNameForTestPath(path, RUN_ID, '1')).not.toBe(databaseNameForTestPath(path, RUN_ID, '2'));
    });

    // El limite de postgres es 63. "kace_t_" (7) + runId (12) + "_" (1) + hash
    // (12) + "_w" (2) + workerId (<=2) = 36.
    it('no se pasa del limite de longitud de postgres', () => {
        const name = databaseNameForTestPath('/repo/tests/x.test.js', 'aaaaaaaabbbb', '16');

        expect(name.length).toBeLessThanOrEqual(63);
    });

    it('exige la identidad de corrida', () => {
        expect(() => databaseNameForTestPath('/repo/tests/x.test.js', undefined, WORKER_ID)).toThrow();
    });

    it('exige el identificador de worker', () => {
        expect(() => databaseNameForTestPath('/repo/tests/x.test.js', RUN_ID)).toThrow('workerId es obligatorio');
    });

    it('rechaza un identificador de worker que no venga de jest', () => {
        expect(() => databaseNameForTestPath('/repo/tests/x.test.js', RUN_ID, 'uno')).toThrow(
            'workerId es obligatorio'
        );
    });

    it('el nombre del template incluye el fingerprint de migraciones', () => {
        const name = templateDatabaseName('abc123def456');

        expect(name).toBe('kace_tpl_abc123def456');
    });

    it('el fingerprint de migraciones es un hash hexadecimal de 12 caracteres', () => {
        const fingerprint = migrationsFingerprint('./node_modules/@kace/database/migrations');

        expect(fingerprint).toMatch(/^[0-9a-f]{12}$/);
    });

    it('el fingerprint es estable si el contenido no cambia', () => {
        const first = migrationsFingerprint('./node_modules/@kace/database/migrations');
        const second = migrationsFingerprint('./node_modules/@kace/database/migrations');

        expect(first).toBe(second);
    });

    it('el fingerprint cambia si cambia el contenido de un archivo con el mismo nombre', () => {
        const directory = mkdtempSync(join(tmpdir(), 'kace-fingerprint-'));

        try {
            writeFileSync(join(directory, '20240101000000_ejemplo.js'), 'export const up = () => 1;');
            const before = migrationsFingerprint(directory);

            writeFileSync(join(directory, '20240101000000_ejemplo.js'), 'export const up = () => 2;');
            const after = migrationsFingerprint(directory);

            expect(after).not.toBe(before);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    describe('fingerprint del payload de permisos', () => {
        it('serializa igual aunque cambie el orden de insercion de las claves', () => {
            expect(stableSerialize({ b: 1, a: 2 })).toBe(stableSerialize({ a: 2, b: 1 }));
        });

        it('preserva el orden de los arrays, que si es significativo', () => {
            expect(stableSerialize([1, 2])).not.toBe(stableSerialize([2, 1]));
        });

        it('produce el mismo hash para el mismo payload con distinto orden de claves', () => {
            const a = { agente: [{ name: 'ver', granted: true }] };
            const b = { agente: [{ granted: true, name: 'ver' }] };

            expect(payloadFingerprint(a)).toBe(payloadFingerprint(b));
        });

        it('cambia el hash si cambia un solo permiso', () => {
            const before = payloadFingerprint({ agente: [{ name: 'ver', granted: true }] });
            const after = payloadFingerprint({ agente: [{ name: 'ver', granted: false }] });

            expect(after).not.toBe(before);
        });

        it('cambia el hash si aparece un permiso nuevo', () => {
            const before = payloadFingerprint({ agente: [{ name: 'ver', granted: true }] });
            const after = payloadFingerprint({
                agente: [
                    { name: 'ver', granted: true },
                    { name: 'editar', granted: true },
                ],
            });

            expect(after).not.toBe(before);
        });

        it('combineFingerprints cambia si cambia cualquiera de las partes', () => {
            const base = combineFingerprints('aaaaaaaaaaaa', 'bbbbbbbbbbbb');

            expect(combineFingerprints('aaaaaaaaaaaa', 'bbbbbbbbbbbb')).toBe(base);
            expect(combineFingerprints('cccccccccccc', 'bbbbbbbbbbbb')).not.toBe(base);
            expect(combineFingerprints('aaaaaaaaaaaa', 'cccccccccccc')).not.toBe(base);
        });

        it('combineFingerprints produce un hash valido para un nombre de base de datos', () => {
            const name = templateDatabaseName(combineFingerprints('aaaaaaaaaaaa', 'bbbbbbbbbbbb'));

            expect(name).toMatch(/^kace_tpl_[0-9a-f]{12}$/);
            expect(name.length).toBeLessThanOrEqual(63);
        });
    });
});
