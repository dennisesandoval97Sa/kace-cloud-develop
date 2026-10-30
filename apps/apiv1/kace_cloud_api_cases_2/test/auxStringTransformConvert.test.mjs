import { describe, it, expect } from '@jest/globals';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';

const dataStructure = {
    contacto: {
        type: 'object',
        required: true,
        data_structure: {
            nombre: { type: 'string', required: true, trim: true, transform: true, lowercase: true },
            documento: { type: 'string', required: true, trim: true, transform: true, uppercase: true },
            edad: { type: 'number', required: false },
        },
    },
};

describe('aux string transforms - contrato buildPartial + validate del controller de cases', () => {
    it('devuelve en value los strings normalizados (trim + casing), sin tocar otros tipos', () => {
        const partial = SchemaBuilder.buildPartial(dataStructure, ['contacto']);
        const schema = SchemaBuilder.build(partial);

        const { error, value } = schema.validate(
            { contacto: { nombre: '  Ana MARÍA  ', documento: '  ab-12  ', edad: 41 } },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.contacto).toEqual({ nombre: 'ana maría', documento: 'AB-12', edad: 41 });
    });

    it('sin reglas declaradas value conserva el string original', () => {
        const plain = { nota: { type: 'object', required: false, data_structure: { txt: { type: 'string' } } } };
        const schema = SchemaBuilder.build(SchemaBuilder.buildPartial(plain, ['nota']));
        const { value } = schema.validate({ nota: { txt: '  Sin Cambios  ' } }, { abortEarly: false });
        expect(value.nota.txt).toBe('  Sin Cambios  ');
    });
});

describe('aux write path del controller de cases_2: sólo se adopta lo enviado', () => {
    const structureConFechaYDefault = {
        contacto: {
            type: 'object',
            required: false,
            data_structure: {
                nombre: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
                fecha: { type: 'date', required: false, iso: true },
                apodo: { type: 'string', required: false, empty: true, default: 'sin-apodo' },
            },
        },
    };

    /*
     * Reproduce el encadenamiento real del controller: buildPartial -> build -> validate ->
     * SchemaConversionsApplier, sobre el mismo objeto `auxValue.data` que luego se persiste.
     */
    const runWritePath = (auxData, structure = structureConFechaYDefault) => {
        const partial = SchemaBuilder.buildPartial(structure, Object.keys(auxData));
        const { error, value } = SchemaBuilder.build(partial).validate(auxData, { abortEarly: false });
        expect(error).toBeUndefined();
        return SchemaConversionsApplier.execute({ target: auxData, converted: value, dataStructure: partial });
    };

    it('aplica trim + uppercase al string enviado', () => {
        const result = runWritePath({ contacto: { nombre: '  ana maría  ' } });
        expect(result.contacto.nombre).toBe('ANA MARÍA');
    });

    it('una fecha que el payload sí envió se persiste tal como se envió', () => {
        const result = runWritePath({ contacto: { nombre: 'ana', fecha: '2026-01-15T10:00:00' } });
        expect(result.contacto.fecha).toBe('2026-01-15T10:00:00');
    });

    it('no materializa el default de un campo que el payload no envió', () => {
        const result = runWritePath({ contacto: { nombre: 'ana' } });
        expect(result.contacto).not.toHaveProperty('apodo');
    });

    it('no inventa una fecha por defecto en un campo que el payload no envió', () => {
        const structure = {
            contacto: {
                type: 'object',
                required: false,
                data_structure: {
                    nombre: { type: 'string', required: false, empty: true, trim: true },
                    fecha: { type: 'date', required: false, iso: true, default: 'now' },
                },
            },
        };
        const auxData = { contacto: { nombre: '  ana  ' } };
        const partial = SchemaBuilder.buildPartial(structure, ['contacto']);
        const { value } = SchemaBuilder.build(partial).validate(auxData, { abortEarly: false });

        const result = SchemaConversionsApplier.execute({
            target: auxData,
            converted: value,
            dataStructure: partial,
        });

        expect(result.contacto).toEqual({ nombre: 'ana' });
    });

    it('un número enviado como string se persiste tal como se envió', () => {
        /*
         * El alcance de este fix son los toggles trim/casing de los campos string; el create de
         * auxiliares de caso nunca adoptó la coerción de Joi y sigue sin hacerlo.
         */
        const structure = {
            contacto: {
                type: 'object',
                required: false,
                data_structure: { edad: { type: 'number', required: false } },
            },
        };
        const auxData = { contacto: { edad: '41' } };
        const partial = SchemaBuilder.buildPartial(structure, ['contacto']);
        const { value } = SchemaBuilder.build(partial).validate(auxData, { abortEarly: false });

        const result = SchemaConversionsApplier.execute({
            target: auxData,
            converted: value,
            dataStructure: partial,
        });

        expect(result.contacto.edad).toBe('41');
    });

    /*
     * Es el camino más habitual del defecto: al crear el auxiliar desde el caso el payload SÍ
     * envía la fecha, así que recortar sólo por ruta no la protegía. Si se guardara convertida,
     * en `withoutTimezone + timezone` y en cualquier config con `timestamp` el valor persistido
     * ya no pasaría su propio esquema y el auxiliar quedaría ineditable.
     */
    const dateConfigs = [
        ['legacy (sin config)', {}, '2026-01-15T10:00:00'],
        ['iso legacy', { iso: true }, '2026-01-15T10:00:00'],
        ['withTimezone', { timezoneFormat: 'withTimezone' }, '2026-01-15T10:00:00-05:00'],
        [
            'withoutTimezone + timezone',
            { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota' },
            '2026-01-15T10:00:00',
        ],
        [
            'withTimezone + timestamp unix',
            { timezoneFormat: 'withTimezone', timestamp: 'unix' },
            '2026-01-15T10:00:00-05:00',
        ],
        [
            'withoutTimezone + timestamp javascript',
            { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota', timestamp: 'javascript' },
            '2026-01-15T10:00:00',
        ],
    ];

    it.each(dateConfigs)(
        'create: la fecha enviada se persiste intacta y el documento sigue siendo editable (%s)',
        (_label, dateConfig, fechaEnviada) => {
            const structure = {
                contacto: {
                    type: 'object',
                    required: false,
                    data_structure: {
                        nombre: { type: 'string', required: false, empty: true, trim: true },
                        fecha: { type: 'date', required: false, ...dateConfig },
                    },
                },
            };

            const persisted = runWritePath({ contacto: { nombre: '  ana  ', fecha: fechaEnviada } }, structure);

            expect(persisted.contacto.fecha).toBe(fechaEnviada);
            expect(persisted.contacto.nombre).toBe('ana');

            // La siguiente edición valida el documento guardado: debe seguir pasando.
            const revalidation = SchemaBuilder.build(structure).validate(persisted, { abortEarly: false });
            expect(revalidation.error).toBeUndefined();
        }
    );
});
