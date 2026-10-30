import { isOrphanTestDatabaseName } from './globalTeardown.js';
import {
    DATABASE_PREFIX,
    TEMPLATE_DATABASE_PREFIX,
    databaseNameForTestPath,
    templateDatabaseName,
} from './dbNaming.js';

describe('isOrphanTestDatabaseName', () => {
    it('selecciona una base de test por-archivo real', () => {
        const name = databaseNameForTestPath('/repo/tests/literals/LiteralIntegration.test.js', 'aaaaaaaabbbb', '1');

        expect(name.startsWith(DATABASE_PREFIX)).toBe(true);
        expect(isOrphanTestDatabaseName(name)).toBe(true);
    });

    it('NO selecciona la base plantilla, pese a que su prefijo comparte texto con DATABASE_PREFIX', () => {
        const templateName = templateDatabaseName('abc123def456');

        // Regresion: un `LIKE 'kace_t_%'` en SQL SI casaba con este nombre, porque
        // `_` es comodin de un caracter en LIKE y el `_` de 'kace_t_' consumia la
        // 'p' de 'tpl'. startsWith (y starts_with en SQL) comparan literal, no casan.
        expect(templateName.startsWith(DATABASE_PREFIX)).toBe(false);
        expect(isOrphanTestDatabaseName(templateName)).toBe(false);
    });

    it('documenta la causa raiz: TEMPLATE_DATABASE_PREFIX comparte los primeros caracteres con DATABASE_PREFIX', () => {
        // Esto es precisamente lo que hacia peligroso un LIKE sin escapar: los dos
        // prefijos difieren solo en que uno tiene un guion bajo donde el otro tiene 'p'.
        expect(TEMPLATE_DATABASE_PREFIX.startsWith('kace_t')).toBe(true);
        expect(DATABASE_PREFIX).toBe('kace_t_');
        expect(TEMPLATE_DATABASE_PREFIX).toBe('kace_tpl_');
    });

    it('no selecciona nombres de bases del sistema u otras bases sin el prefijo de test', () => {
        expect(isOrphanTestDatabaseName('postgres')).toBe(false);
        expect(isOrphanTestDatabaseName('template0')).toBe(false);
        expect(isOrphanTestDatabaseName('template1')).toBe(false);
    });

    it('no falla con valores no-string', () => {
        expect(isOrphanTestDatabaseName(undefined)).toBe(false);
        expect(isOrphanTestDatabaseName(null)).toBe(false);
    });
});
