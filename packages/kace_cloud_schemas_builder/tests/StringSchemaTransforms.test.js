import Joi from 'joi';
import SchemaBuilder from '../src/SchemaBuilder';
import StringSchemaBuilder from '../src/builders/StringSchemaBuilder';

describe('StringSchemaBuilder - convert transforms (trim / lowercase / uppercase)', () => {
    const build = (overrides) => SchemaBuilder.build({ type: 'string', required: true, ...overrides });

    describe('trim', () => {
        it('recorta espacios al inicio y final cuando trim: true', () => {
            const { error, value } = build({ trim: true }).validate('  hola mundo  ');
            expect(error).toBeUndefined();
            expect(value).toBe('hola mundo');
        });

        it('no toca el valor cuando trim no está declarado', () => {
            const { value } = build({}).validate('  hola  ');
            expect(value).toBe('  hola  ');
        });

        it('registra la regla trim en el describe()', () => {
            const description = build({ trim: true }).describe();
            expect(description.rules).toEqual(expect.arrayContaining([{ name: 'trim', args: { enabled: true } }]));
        });
    });

    describe('lowercase', () => {
        it('pasa a minúsculas cuando lowercase: true', () => {
            const { error, value } = build({ lowercase: true }).validate('HOLA Mundo');
            expect(error).toBeUndefined();
            expect(value).toBe('hola mundo');
        });

        it('registra la regla case:low en el describe()', () => {
            const description = build({ lowercase: true }).describe();
            expect(description.rules).toEqual(expect.arrayContaining([{ name: 'case', args: { direction: 'lower' } }]));
        });
    });

    describe('uppercase', () => {
        it('pasa a mayúsculas cuando uppercase: true', () => {
            const { error, value } = build({ uppercase: true }).validate('hola Mundo');
            expect(error).toBeUndefined();
            expect(value).toBe('HOLA MUNDO');
        });

        it('registra la regla case:upper en el describe()', () => {
            const description = build({ uppercase: true }).describe();
            expect(description.rules).toEqual(expect.arrayContaining([{ name: 'case', args: { direction: 'upper' } }]));
        });
    });

    describe('combinaciones', () => {
        it('trim + lowercase se aplican juntos', () => {
            const { value } = build({ trim: true, lowercase: true }).validate('   HOLA   ');
            expect(value).toBe('hola');
        });

        it('trim + uppercase se aplican juntos', () => {
            const { value } = build({ trim: true, uppercase: true }).validate('   hola   ');
            expect(value).toBe('HOLA');
        });

        it('la clave "transform" del frontend es ignorada por el builder sin romper', () => {
            expect(() => build({ transform: true, trim: true })).not.toThrow();
            const { value } = build({ transform: true, trim: true }).validate('  x  ');
            expect(value).toBe('x');
        });
    });

    describe('estructura anidada (#buildTree)', () => {
        const structure = {
            formA: {
                type: 'object',
                required: true,
                data_structure: {
                    nombre: { type: 'string', required: true, trim: true, lowercase: true },
                    codigo: { type: 'string', required: true, trim: true, uppercase: true },
                    edad: { type: 'number', required: false },
                },
            },
        };

        it('transforma cada string anidado sin tocar los hermanos de otro tipo', () => {
            const schema = SchemaBuilder.build(structure);
            const { error, value } = schema.validate(
                { formA: { nombre: '  Ana MARÍA ', codigo: ' ab-12 ', edad: 30 } },
                { allowUnknown: true }
            );
            expect(error).toBeUndefined();
            expect(value.formA).toEqual({ nombre: 'ana maría', codigo: 'AB-12', edad: 30 });
        });

        it('preserva claves desconocidas presentes sólo en el JSONB persistido', () => {
            const schema = SchemaBuilder.build(structure);
            const { value } = schema.validate(
                { formA: { nombre: ' X ', codigo: ' y ', legado: 'OLD-1' } },
                { allowUnknown: true }
            );
            expect(value.formA.legado).toBe('OLD-1');
            expect(value.formA.nombre).toBe('x');
        });
    });

    it('StringSchemaBuilder.build devuelve un Joi.string aunque el dto venga vacío', () => {
        expect(Joi.isSchema(StringSchemaBuilder.build({}))).toBe(true);
    });
});
