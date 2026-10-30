import { schemaCreate, schemaPreview } from '../src/schemas.mjs';

const validSegments = [
    { type: 'literal', value: '5' },
    { type: 'date', format: 'YY' },
    { type: 'field', path: 'aux_cases.asistencia_movilidad.monitoreo_proveedor_hidden.canal' },
    { type: 'sequence', length: 9, pad_char: '0' },
];

const base = (overrides = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Radicado PQRS',
    segments: validSegments,
    status: 1,
    reset_policy: 'never',
    start_value: 50,
    ...overrides,
});

describe('schemas de configuración de folio', () => {
    it('acepta la configuración del enunciado', () => {
        const { error } = schemaCreate.validate(base());
        expect(error).toBeUndefined();
    });

    it('exige exactamente un segmento de consecutivo', () => {
        expect(schemaCreate.validate(base({ segments: [{ type: 'literal', value: 'A' }] })).error).toBeDefined();
        expect(
            schemaCreate.validate(
                base({
                    segments: [
                        { type: 'sequence', length: 4 },
                        { type: 'sequence', length: 4 },
                    ],
                })
            ).error
        ).toBeDefined();
    });

    it('rechaza formatos de fecha fuera de la lista blanca', () => {
        const segments = [
            { type: 'date', format: '[año]YYYY' },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    it.each([['aux_cases.form.grupo.campo'], ['cases.external_code'], ['clasificaciones.nivel1']])(
        'acepta la ruta %s',
        (path) => {
            const segments = [
                { type: 'field', path },
                { type: 'sequence', length: 4 },
            ];
            expect(schemaCreate.validate(base({ segments })).error).toBeUndefined();
        }
    );

    it.each([
        ['aux_cases'], // sin punto: no identifica entidad + campo
        ['aux_cases.'],
        ['aux_cases..campo'],
        ["aux_cases.form'; DROP TABLE cases;--"],
    ])('rechaza la ruta inválida %s', (path) => {
        const segments = [
            { type: 'field', path },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    /*
     * `transform` y `date.source` se retiraron del dominio. Se fija aquí para que no
     * vuelvan por la puerta de atrás: Joi rechaza claves desconocidas.
     */
    it('rechaza un pipeline transform, que ya no existe', () => {
        const segments = [
            { type: 'field', path: 'aux_cases.f.tipo', transform: [{ op: 'upper' }] },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    it('rechaza date.source, que ya no existe', () => {
        const segments = [
            { type: 'date', format: 'YY', source: 'case_field', path: 'cases.created_at' },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    it('rechaza una path en un segmento de fecha', () => {
        const segments = [
            { type: 'date', format: 'YY', path: 'cases.created_at' },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    it('no permite mezclar parámetros de tipos distintos', () => {
        const segments = [
            { type: 'literal', value: 'A', length: 4 },
            { type: 'sequence', length: 4 },
        ];
        expect(schemaCreate.validate(base({ segments })).error).toBeDefined();
    });

    it('acota el consecutivo a 9 dígitos y el valor inicial a int4, las columnas del contador', () => {
        const withLength = (length) => [
            { type: 'literal', value: 'R' },
            { type: 'sequence', length },
        ];
        expect(schemaCreate.validate(base({ segments: withLength(9) })).error).toBeUndefined();
        expect(schemaCreate.validate(base({ segments: withLength(10) })).error).toBeDefined();
        expect(schemaCreate.validate(base({ start_value: 2147483648 })).error).toBeDefined();
    });

    it('exige al menos 3 caracteres en el nombre, como el value object', () => {
        expect(schemaCreate.validate(base({ nombre: 'AB' })).error).toBeDefined();
    });

    it('preview acepta un borrador sin guardar o un id', () => {
        expect(schemaPreview.validate({ segments: validSegments }).error).toBeUndefined();
        expect(schemaPreview.validate({ id: '11111111-1111-4111-8111-111111111111' }).error).toBeUndefined();
        expect(schemaPreview.validate({}).error).toBeDefined();
    });
});
