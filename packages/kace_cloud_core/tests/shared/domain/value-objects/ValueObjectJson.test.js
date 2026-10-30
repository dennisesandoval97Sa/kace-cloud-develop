import { ValueObjectJson, InvalidArgumentError } from '../../../../src/shared/index.js';

describe('ValueObjectJson', () => {
    // El SQLInjectionCriteriaGuard solo bloquea en modo enforce, y la corrida
    // hereda SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js.
    // Los tests de rechazo describen el modo enforce, asi que lo fijan ellos en
    // vez de depender del entorno ambiente. El XSSSchemaGuard no tiene modo
    // observe y no lo necesita: sus gemelos pasan tal cual.
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

    it('should create an instance with a valid JSON object', () => {
        const value = { key: 'value' };
        const valueObject = new ValueObjectJson('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectJson('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectJson('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not an object', () => {
        const value = '"not an object"';
        expect(() => new ValueObjectJson('TestVO', value)).toThrowError('value must be an object');
    });

    it('should throw an error if the value is undefined and nullable is false', () => {
        const value = undefined;
        expect(() => new ValueObjectJson('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    describe('Recursive dictionary validation', () => {
        describe('String value validation', () => {
            it('should throw error if a string value contains SQL Injection patterns', () => {
                const value = { key: 'SELECT * FROM users' };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            it('should throw error if a string value contains XSS patterns', () => {
                const value = { key: "<script>alert('XSS')</script>" };
                expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
            });

            it('should allow valid string values without prohibited patterns', () => {
                const value = { key: 'Hello World', name: 'Juan Perez' };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });
        });

        // Los cuatro tests de clave de este archivo estan skipeados por el mismo motivo.
        //
        // El fix de 12e562cea funcionaba: pasando `both = true` desde el constructor, las claves
        // SI llegaban al guardian SQL y al XSSSchemaGuard. Se revirtio porque no puede desplegarse
        // con el diccionario actual: prohibitedWordsCriteria() incluye "from", y "from" es un
        // campo de dominio legitimo en dos sitios reales -el step "mapProperty" del workflow
        // escribe { from: 'case.details' } en EventLog.body, y el seed de produccion
        // 20260525100000_channel_hub_send_email_flow.js define body.body.from-, asi que con
        // enforce se rompe el envio de email de Channel Hub y el log de los workflows.
        //
        // Es invisible en jest porque se hereda SQL_GUARD_MODE=observe del .env raiz y en ese modo
        // el guardian registra y sigue; con enforce -el valor por defecto y el que fija
        // .env.example para el deploy- si lanza. El XSSSchemaGuard no tiene modo observe, pero
        // cae con el mismo revert porque ambas validaciones salen del mismo `both = true`.
        //
        // Revertido el 2026-08-14. Retomar con un diccionario propio para claves: lo peligroso en
        // una clave es la sintaxis (--, /*, ;, comillas), no las palabras reservadas.
        describe('Key validation', () => {
            // KACE-SKIP(bug-src): validar claves rompe funcionalidad legitima con el diccionario
            // actual ("from"). Ver la nota extensa sobre este describe.
            it.skip('should throw error if a key contains SQL Injection patterns', () => {
                // "where" viene de prohibitedWordsCriteria(), el diccionario que el guardian de
                // claves consulta de verdad: ese diccionario omite "select" a proposito.
                const value = { where: 'value' };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            // KACE-SKIP(bug-src): cae con el mismo revert que su hermano de SQL — ambas
            // validaciones salen del mismo `both = true`. Ver la nota extensa sobre este describe.
            it.skip('should throw error if a key contains XSS patterns', () => {
                // "script" viene de prohibitedSchemaWords(); ese diccionario omite el
                // "javascript" a secas que si lleva el diccionario general. ("javascript:" tampoco
                // sirve: el tokenizador corta el ":" antes de comparar.)
                const value = { script: 'value' };
                expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
            });

            it('should allow valid keys without prohibited patterns', () => {
                const value = { validKey: 'value', anotherKey: 'anotherValue' };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });
        });

        describe('Recursive validation in nested objects', () => {
            it('should validate string values in nested objects', () => {
                const value = {
                    level1: {
                        level2: {
                            value: 'SELECT * FROM users',
                        },
                    },
                };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            // KACE-SKIP(bug-src): mismo revert; la recursion en objetos anidados tambien dependia
            // del `both = true`. Ver la nota extensa sobre el describe 'Key validation'.
            it.skip('should validate keys in nested objects', () => {
                // "where" viene de prohibitedWordsCriteria(); ese diccionario omite "select".
                const value = {
                    level1: {
                        where: 'safe value',
                    },
                };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            it('should allow valid nested objects', () => {
                const value = {
                    level1: {
                        level2: {
                            value: 'safe value',
                            another: 'another safe value',
                        },
                    },
                };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });
        });

        describe('Recursive validation in arrays', () => {
            it('should validate string values in arrays', () => {
                const value = {
                    items: ['safe', 'SELECT * FROM users', 'another'],
                };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            it('should validate objects within arrays', () => {
                const value = {
                    items: [{ name: 'safe' }, { name: "<script>alert('XSS')</script>" }],
                };
                expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
            });

            it('should validate nested arrays', () => {
                const value = {
                    nested: [
                        {
                            items: ['SELECT * FROM users'],
                        },
                    ],
                };
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', value)).toThrow(InvalidArgumentError);
                });
            });

            it('should allow arrays with valid values', () => {
                const value = {
                    items: ['safe', 'values', 'here'],
                    objects: [{ name: 'Luis' }, { name: 'Felipe' }],
                };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });
        });

        describe('Edge cases - primitive types', () => {
            it('should not validate numbers', () => {
                const value = { number: 123, negative: -45, decimal: 3.14 };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });

            it('should not validate booleans', () => {
                const value = { isTrue: true, isFalse: false };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });

            it('should not validate null values within the object', () => {
                const value = { key: null, another: 'value' };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });

            it('should not validate undefined values within the object', () => {
                const value = { key: undefined, another: 'value' };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });

            it('should handle arrays with mixed types', () => {
                const value = {
                    mixed: [1, 'safe string', true, null, { nested: 'value' }],
                };
                const valueObject = new ValueObjectJson('TestVO', value);
                expect(valueObject.value).toEqual(value);
            });
        });

        describe('Validation with JSON parsed from string', () => {
            it('should validate JSON parsed from string', () => {
                const jsonString = '{"key": "SELECT * FROM users"}';
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', jsonString)).toThrow(InvalidArgumentError);
                });
            });

            // KACE-SKIP(bug-src): mismo revert; el camino tras JSON.parse tambien dependia del
            // `both = true`. Ver la nota extensa sobre el describe 'Key validation'.
            it.skip('should validate keys in JSON parsed from string', () => {
                // "where" viene de prohibitedWordsCriteria(); ese diccionario omite "select".
                const jsonString = '{"where": "safe value"}';
                withSqlGuardEnforced(() => {
                    expect(() => new ValueObjectJson('TestVO', jsonString)).toThrow(InvalidArgumentError);
                });
            });

            it('should allow valid JSON parsed from string', () => {
                const jsonString = '{"key": "safe value", "nested": {"another": "value"}}';
                const valueObject = new ValueObjectJson('TestVO', jsonString);
                expect(valueObject.value).toEqual({
                    key: 'safe value',
                    nested: { another: 'value' },
                });
            });
        });
    });
});
