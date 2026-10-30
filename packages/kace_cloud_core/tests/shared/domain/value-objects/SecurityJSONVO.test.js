import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValueObjectJson } from '../../../../src/shared/domain/value-object/ValueObjectJson.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcPath = path.resolve(__dirname, '../../../../src');

function findFiles(dir, extension, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findFiles(filePath, extension, fileList);
        } else {
            if (file.endsWith(extension)) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

describe('SecurityJSONVO Dynamic Tests', () => {
    const files = findFiles(srcPath, '.js');
    const classesToTest = [];

    // Lo que exige el test es que la subclase RECHACE el payload, no que lo haga
    // siempre por el mismo camino. Las VO con allowlist de claves propia (p.ej.
    // VOBoardQuickAnsFilter) lo tumban antes, al no reconocer la clave, y nunca
    // llegan al filtro de palabras prohibidas: ese rechazo es igual de valido.
    const REJECTION_MESSAGE = /Palabras prohibidas|SQL blacklist|unknown key/;

    // El SQLInjectionCriteriaGuard solo bloquea en modo enforce, y la corrida
    // hereda SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js.
    // Estos tests describen el modo enforce, asi que lo fijan ellos en vez de
    // depender del entorno ambiente.
    const withSqlGuardEnforced = (assertion) => {
        const previous = process.env.SQL_GUARD_MODE;
        process.env.SQL_GUARD_MODE = 'enforce';

        try {
            assertion();
        } finally {
            if (previous === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = previous;
            }
        }
    };

    beforeAll(async () => {
        for (const file of files) {
            try {
                const module = await import(`file://${file}`);
                Object.values(module).forEach((exportedItem) => {
                    if (
                        typeof exportedItem === 'function' &&
                        exportedItem.prototype instanceof ValueObjectJson &&
                        exportedItem !== ValueObjectJson &&
                        classesToTest.find((c) => c.Class === exportedItem) === undefined
                    ) {
                        classesToTest.push({
                            name: exportedItem.name,
                            Class: exportedItem,
                            filePath: file,
                        });
                    }
                });
            } catch (e) {}
        }
        console.log(`Found ${classesToTest.length} classes extending ValueObjectJson`);
    });

    test('All ValueObjectJson subclasses should be discovered', () => {
        expect(classesToTest.length).toBeGreaterThan(0);
    });

    test('Subclasses should reject XSS payloads', () => {
        const xssPayload = { key: "<script>alert('XSS')</script>", encoding: "<script>alert('XSS')</script>" };
        withSqlGuardEnforced(() => {
            classesToTest.forEach(({ name, Class }, index) => {
                console.log(`Testing ${name} (${index + 1}/${classesToTest.length})`);
                try {
                    const args = Class.length >= 2 ? ['test_field', xssPayload] : [xssPayload];
                    new Class(...args);
                    throw new Error(`${name} did not throw error for XSS payload`);
                } catch (error) {
                    if (error.message.includes('[object Object]')) {
                        try {
                            new Class('test_field', xssPayload);
                        } catch (err) {
                            expect(err).toBeInstanceOf(Error);
                            expect(err.message).toMatch(REJECTION_MESSAGE);
                            return;
                        }
                    }
                    if (error.message.includes('did not throw error for XSS payload')) {
                        throw error;
                    }
                    expect(error).toBeInstanceOf(Error);
                    expect(error.message).toMatch(REJECTION_MESSAGE);
                }
            });
        });
    });

    test('Subclasses should reject SQL Injection payloads', () => {
        const sqlPayload = { key: 'UNION SELECT * FROM users', encoding: 'UNION SELECT * FROM users' };
        withSqlGuardEnforced(() => {
            classesToTest.forEach(({ name, Class }) => {
                try {
                    const args = Class.length >= 2 ? ['test_field', sqlPayload] : [sqlPayload];
                    new Class(...args);
                    throw new Error(`${name} did not throw error for SQL Injection payload`);
                } catch (error) {
                    if (error.message.includes('[object Object]')) {
                        try {
                            new Class('test_field', sqlPayload);
                        } catch (err) {
                            expect(err).toBeInstanceOf(Error);
                            expect(err.message).toMatch(REJECTION_MESSAGE);
                            return;
                        }
                    }
                    if (error.message.includes('did not throw error for SQL Injection payload')) {
                        throw error;
                    }
                    expect(error).toBeInstanceOf(Error);
                    expect(error.message).toMatch(REJECTION_MESSAGE);
                }
            });
        });
    });
});
