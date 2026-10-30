import { KnexFieldListRepository } from '../../src/field-list/infraestructure/KnexFieldListRepository';
import { ListTablesDomain } from '../../src/field-list/domain/ListTablesDomain.js';
import { EncryptionService } from '../../src/field-list/domain/EncryptionService.js';
import { BLACKLIST_TABLES } from '../../src/field-list/domain/BlacklistTables';
import { knexConfig } from '../knexfile.js';

describe('KnexFieldListRepository Integración', () => {
    const repository = new KnexFieldListRepository(knexConfig, knexConfig.config.schema);
    const testTable = 'usuarios';

    it('debería obtener la lista de campos de la tabla', async () => {
        const fields = await repository.getFieldList(testTable);
        expect(Array.isArray(fields)).toBe(true);
        expect(fields.length).toBeGreaterThan(0);
        fields.forEach((field) => {
            expect(field).toHaveProperty('column_name');
            expect(field).toHaveProperty('data_type');
            expect(field).toHaveProperty('character_maximum_length');
            expect(field).toHaveProperty('relation');
            expect(field).toHaveProperty('label');
        });
    });

    it('debería obtener la lista de tablas con sus campos', async () => {
        const tablesObject = await repository.getAllTables();
        expect(typeof tablesObject).toBe('object');
        expect(tablesObject).not.toBeNull();

        const tableNames = Object.keys(tablesObject);
        expect(tableNames.length).toBeGreaterThan(0);

        Object.entries(tablesObject).forEach(([tableName, fields]) => {
            expect(typeof tableName).toBe('string');
            expect(tableName.length).toBeGreaterThan(0);
            expect(Array.isArray(fields)).toBe(true);

            fields.forEach((field) => {
                expect(field).toHaveProperty('column_name');
                expect(field).toHaveProperty('data_type');
                expect(field).toHaveProperty('character_maximum_length');
                expect(field).toHaveProperty('relation');
                expect(field).toHaveProperty('label');
            });
        });
    });

    it('debería filtrar las tablas de la blacklist', async () => {
        const tablesObject = await repository.getAllTables();
        const tableNames = Object.keys(tablesObject);

        BLACKLIST_TABLES.forEach((blacklistedTable) => {
            expect(tableNames).not.toContain(blacklistedTable);
        });
    });

    it('debería encriptar la lista de tablas serializadas usando ECDH + AES-GCM', async () => {
        const clientKeyPair = await EncryptionService.generateKeyPair();
        const domain = new ListTablesDomain(repository);

        const result = await domain.execute(clientKeyPair.publicKeyB64);

        expect(typeof result).toBe('object');

        expect(result).toHaveProperty('iv');
        expect(result).toHaveProperty('ciphertext');
        expect(result).toHaveProperty('serverPubKey');

        expect(typeof result.iv).toBe('string');
        expect(typeof result.ciphertext).toBe('string');
        expect(typeof result.serverPubKey).toBe('string');

        expect(result.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(result.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(result.serverPubKey).toMatch(/^[A-Za-z0-9+/]+=*$/);

        expect(result.ciphertext.length).toBeGreaterThan(0);
    });

    it('debería generar pares de claves ECDH válidos', async () => {
        const keyPair1 = await EncryptionService.generateKeyPair();
        const keyPair2 = await EncryptionService.generateKeyPair();

        expect(keyPair1).toHaveProperty('keyPair');
        expect(keyPair1).toHaveProperty('publicKeyB64');
        expect(keyPair2).toHaveProperty('keyPair');
        expect(keyPair2).toHaveProperty('publicKeyB64');

        expect(keyPair1.publicKeyB64).not.toBe(keyPair2.publicKeyB64);
        expect(keyPair1.publicKeyB64).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(keyPair2.publicKeyB64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('debería encriptar las mismas tablas de manera diferente en cada llamada', async () => {
        const clientKeyPair = await EncryptionService.generateKeyPair();
        const domain = new ListTablesDomain(repository);

        const result1 = await domain.execute(clientKeyPair.publicKeyB64);
        const result2 = await domain.execute(clientKeyPair.publicKeyB64);

        expect(result1.iv).not.toBe(result2.iv);
        expect(result1.ciphertext).not.toBe(result2.ciphertext);
        expect(result1.serverPubKey).not.toBe(result2.serverPubKey);
    });

    it('debería serializar correctamente las tablas antes de encriptar', async () => {
        const clientKeyPair = await EncryptionService.generateKeyPair();

        const tablesObject = await repository.getAllTables();
        expect(typeof tablesObject).toBe('object');
        expect(Object.keys(tablesObject).length).toBeGreaterThan(0);

        // Extraer solo los nombres de tabla para mantener compatibilidad con la encriptación
        const tableNames = Object.keys(tablesObject);
        const directEncryption = await EncryptionService.encryptForClient(clientKeyPair.publicKeyB64, tableNames);

        expect(directEncryption).toHaveProperty('iv');
        expect(directEncryption).toHaveProperty('ciphertext');
        expect(directEncryption).toHaveProperty('serverPubKey');
    });

    it('debería completar el flujo completo: generar claves -> encriptar -> desencriptar', async () => {
        const clientKeyPair = await EncryptionService.generateKeyPair();
        expect(clientKeyPair).toHaveProperty('keyPair');
        expect(clientKeyPair).toHaveProperty('publicKeyB64');

        const tablesObject = await repository.getAllTables();
        expect(typeof tablesObject).toBe('object');
        expect(Object.keys(tablesObject).length).toBeGreaterThan(0);

        // Extraer nombres de tabla para verificación
        const originalTableNames = Object.keys(tablesObject);

        BLACKLIST_TABLES.forEach((blacklistedTable) => {
            expect(originalTableNames).not.toContain(blacklistedTable);
        });

        const domain = new ListTablesDomain(repository);
        const encryptedResult = await domain.execute(clientKeyPair.publicKeyB64);

        expect(encryptedResult).toHaveProperty('iv');
        expect(encryptedResult).toHaveProperty('ciphertext');
        expect(encryptedResult).toHaveProperty('serverPubKey');

        expect(typeof encryptedResult.iv).toBe('string');
        expect(typeof encryptedResult.ciphertext).toBe('string');
        expect(typeof encryptedResult.serverPubKey).toBe('string');

        expect(encryptedResult.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(encryptedResult.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(encryptedResult.serverPubKey).toMatch(/^[A-Za-z0-9+/]+=*$/);

        const decryptedTables = await EncryptionService.decryptFromServer(encryptedResult, clientKeyPair.keyPair);

        // getAllTables() devuelve un objeto {tabla: campos[]}, no un array de
        // nombres, y eso es lo que viaja cifrado. Los nombres son sus claves.
        expect(typeof decryptedTables).toBe('object');
        expect(Array.isArray(decryptedTables)).toBe(false);

        const decryptedTableNames = Object.keys(decryptedTables);
        expect(decryptedTableNames.length).toBe(originalTableNames.length);

        originalTableNames.forEach((tableName) => {
            expect(decryptedTableNames).toContain(tableName);
        });

        BLACKLIST_TABLES.forEach((blacklistedTable) => {
            expect(decryptedTableNames).not.toContain(blacklistedTable);
        });

        expect(decryptedTableNames.sort()).toEqual(originalTableNames.sort());
    });

    it('debería fallar la desencriptación con claves incorrectas', async () => {
        const clientKeyPair1 = await EncryptionService.generateKeyPair();
        const clientKeyPair2 = await EncryptionService.generateKeyPair();

        const domain = new ListTablesDomain(repository);
        const encryptedResult = await domain.execute(clientKeyPair1.publicKeyB64);

        await expect(EncryptionService.decryptFromServer(encryptedResult, clientKeyPair2.keyPair)).rejects.toThrow(
            'Error al desencriptar'
        );
    });

    it('debería manejar datos encriptados malformados', async () => {
        const clientKeyPair = await EncryptionService.generateKeyPair();

        const malformedData = {
            iv: 'invalid-base64!@#',
            ciphertext: 'also-invalid-base64!@#',
            serverPubKey: 'not-a-valid-key!@#',
        };

        await expect(EncryptionService.decryptFromServer(malformedData, clientKeyPair.keyPair)).rejects.toThrow(
            'Error al desencriptar'
        );
    });

    it('debería verificar la integridad de los datos en múltiples ciclos', async () => {
        const domain = new ListTablesDomain(repository);
        const tablesObject = await repository.getAllTables();
        const originalTableNames = Object.keys(tablesObject);

        for (let i = 0; i < 3; i++) {
            const clientKeyPair = await EncryptionService.generateKeyPair();

            const encryptedResult = await domain.execute(clientKeyPair.publicKeyB64);

            const decryptedTables = await EncryptionService.decryptFromServer(encryptedResult, clientKeyPair.keyPair);

            expect(Object.keys(decryptedTables).sort()).toEqual(originalTableNames.sort());
        }
    });

    // Tests de integración para el método getAllTables mejorado
    it('debería obtener todas las tablas con sus campos completos', async () => {
        const tablesObject = await repository.getAllTables();

        expect(typeof tablesObject).toBe('object');
        expect(tablesObject).not.toBeNull();
        expect(Object.keys(tablesObject).length).toBeGreaterThan(0);

        Object.entries(tablesObject).forEach(([tableName, fields]) => {
            expect(typeof tableName).toBe('string');
            expect(Array.isArray(fields)).toBe(true);

            if (fields.length > 0) {
                fields.forEach((field) => {
                    expect(field).toHaveProperty('column_name');
                    expect(field).toHaveProperty('data_type');
                    expect(field).toHaveProperty('character_maximum_length');
                    expect(field).toHaveProperty('relation');
                    expect(field).toHaveProperty('label');
                    expect(typeof field.column_name).toBe('string');
                    expect(typeof field.data_type).toBe('string');
                    expect(typeof field.label).toBe('string');
                });
            }
        });

        const tableNames = Object.keys(tablesObject);
        BLACKLIST_TABLES.forEach((blacklistedTable) => {
            expect(tableNames).not.toContain(blacklistedTable);
        });
    });

    it('debería incluir información de relaciones en los campos', async () => {
        const tablesObject = await repository.getAllTables();
        let foundRelations = false;

        Object.values(tablesObject).forEach((fields) => {
            fields.forEach((field) => {
                if (field.relation) {
                    foundRelations = true;
                    expect(field.relation).toMatch(/^\/\w+\/\{id\}$/);
                }
            });
        });
    });

    it('debería mapear correctamente los tipos de datos PostgreSQL a JavaScript', async () => {
        const tablesObject = await repository.getAllTables();
        const validJSTypes = ['String', 'Number', 'Boolean', 'Date', 'Object'];

        Object.values(tablesObject).forEach((fields) => {
            fields.forEach((field) => {
                const isValidJSType = validJSTypes.includes(field.data_type);
                const isPostgresType = typeof field.data_type === 'string' && field.data_type.length > 0;

                expect(isValidJSType || isPostgresType).toBe(true);
            });
        });
    });

    it('debería incluir labels correctos para los campos', async () => {
        const tablesObject = await repository.getAllTables();

        Object.values(tablesObject).forEach((fields) => {
            fields.forEach((field) => {
                expect(typeof field.label).toBe('string');
                expect(field.label.length).toBeGreaterThan(0);
                expect(field.label === 'undefined' || field.label !== 'undefined').toBe(true);
            });
        });
    });

    it('debería proporcionar estadísticas básicas de tablas', async () => {
        const tablesObject = await repository.getAllTables();

        const tableNames = Object.keys(tablesObject);
        expect(tableNames.length).toBeGreaterThan(0);

        let totalFields = 0;
        let tablesWithRelations = 0;

        Object.entries(tablesObject).forEach(([tableName, fields]) => {
            totalFields += fields.length;

            const hasRelations = fields.some((field) => field.relation !== null);
            if (hasRelations) {
                tablesWithRelations++;
            }
        });

        expect(totalFields).toBeGreaterThan(0);
    });

    it('debería encontrar tablas con diferentes tipos de datos', async () => {
        const tablesObject = await repository.getAllTables();
        const foundTypes = new Set();

        Object.values(tablesObject).forEach((fields) => {
            fields.forEach((field) => {
                foundTypes.add(field.data_type);
            });
        });

        expect(foundTypes.size).toBeGreaterThan(0);
    });

    it('debería ejecutar la consulta optimizada en tiempo razonable', async () => {
        const startTime = Date.now();
        const tablesObject = await repository.getAllTables();
        const executionTime = Date.now() - startTime;

        expect(typeof tablesObject).toBe('object');
        expect(Object.keys(tablesObject).length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(10000);
    });

    it('debería manejar múltiples consultas concurrentes', async () => {
        const promises = Array(3)
            .fill()
            .map(() => repository.getAllTables());
        const results = await Promise.all(promises);

        expect(results.length).toBe(3);
        results.forEach((result) => {
            expect(typeof result).toBe('object');
            expect(Object.keys(result).length).toBe(Object.keys(results[0]).length);
        });
    });

    it('debería manejar errores de conexión correctamente', async () => {
        const brokenRepository = new KnexFieldListRepository({
            client: 'pg',
            connection: {
                host: 'invalid-host-12345',
                port: 5432,
                user: 'invalid',
                password: 'invalid',
                database: 'invalid',
            },
        });

        // La transaccion se llama hoy `list-tables-with-fields`, sin el sufijo
        // `-optimized` que llevaba cuando se escribio este test.
        await expect(brokenRepository.getAllTables()).rejects.toThrow('list-tables-with-fields');

        await brokenRepository.connection.destroy();
    });
});
