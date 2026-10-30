import { SQLInjectionDictionary } from '../../../../src/shared/domain/security/SQLInjectionDictionary';
import { SQLInjectionGuard } from '../../../../src/shared/domain/guards/SQLInjectionGuard';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError';

describe('SQLInjectionDictionary', () => {
    test('should detect known SQL Injection patterns', () => {
        const input = "SELECT * FROM users WHERE name = 'John'";
        const expectedPatterns = ['select'];
        const detectedPatterns = SQLInjectionDictionary.findSQLInjectionPatterns(input);
        expect(detectedPatterns).toEqual(expect.arrayContaining(expectedPatterns));
    });

    test('should return empty for non-string input', () => {
        const input = 12345;
        const result = SQLInjectionDictionary.findSQLInjectionPatterns(input);
        expect(result).toEqual([]);
    });

    test('should return an empty array if no SQL Injection patterns are found', () => {
        const input = 'Hello World!';
        const result = SQLInjectionDictionary.findSQLInjectionPatterns(input);
        expect(result).toEqual([]);
    });

    it('should detect SQL injection patterns', () => {
        const dangerousInputs = ["'; DROP TABLE users; --", "admin' false", 'EXEC xp_cmdshell'];

        dangerousInputs.forEach((input) => {
            const result = SQLInjectionDictionary.findSQLInjectionPatterns(input);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    it('should not flag safe inputs', () => {
        const safeInputs = ['Sure text', "John O'Brien", 'This is a normal string with no SQL', 'intoleranz'];

        safeInputs.forEach((input) => {
            const result = SQLInjectionDictionary.findSQLInjectionPatterns(input);
            expect(result).toHaveLength(0);
        });
    });
});

describe('SQLInjectionGuard', () => {
    // El SQLInjectionGuard solo bloquea en modo enforce, y la corrida hereda
    // SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js. Este
    // test describe el modo enforce, asi que lo fija el mismo en vez de depender
    // del entorno ambiente. El XSSGuard no tiene modo observe y no lo necesita.
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

    test('should throw InvalidArgumentError if SQL Injection patterns are detected', () => {
        const input = "SELECT * FROM users WHERE name = 'John'";
        withSqlGuardEnforced(() => {
            expect(() => {
                SQLInjectionGuard.validate(input, 'test');
            }).toThrow(InvalidArgumentError);
        });
    });

    test('should not throw an error if no SQL Injection patterns are detected', () => {
        const input = 'Hello World!';
        expect(() => {
            SQLInjectionGuard.validate(input, 'test');
        }).not.toThrow();
    });
});
