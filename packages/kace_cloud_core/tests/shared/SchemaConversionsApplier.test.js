import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
    SchemaConversionsApplier,
    TEXT_SOURCE_ADOPTABLE_TYPES,
} from '../../src/shared/domain/services/SchemaConversionsApplier.js';

const formAStructure = (fields) => ({
    formA: { type: 'object', required: false, data_structure: fields },
});

const notaYFecha = formAStructure({
    nota: { type: 'string', required: false, empty: true, trim: true },
    fecha: { type: 'date', required: false, iso: true },
});

describe('SchemaConversionsApplier', () => {
    it('adopta el valor convertido en las rutas string enviadas por el patch', () => {
        const result = SchemaConversionsApplier.execute({
            target: { formA: { nota: '  y  ', fecha: '2026-01-15T10:00:00' } },
            converted: { formA: { nota: 'y', fecha: new Date('2026-01-15T15:00:00.000Z') } },
            dataStructure: notaYFecha,
            patch: { formA: { nota: '  y  ' } },
        });

        expect(result).toEqual({ formA: { nota: 'y', fecha: '2026-01-15T10:00:00' } });
    });

    it('ignora las claves que el patch no envió aunque el converted las traiga', () => {
        const result = SchemaConversionsApplier.execute({
            target: { formA: { nota: 'y' } },
            converted: { formA: { nota: 'y', apodo: 'sin-apodo' } },
            dataStructure: formAStructure({
                nota: { type: 'string', required: false, empty: true },
                apodo: { type: 'string', required: false, empty: true, default: 'sin-apodo' },
            }),
            patch: { formA: { nota: 'y' } },
        });

        expect(result).toEqual({ formA: { nota: 'y' } });
    });

    it('conserva la referencia de las ramas que el patch no tocó', () => {
        const formB = { otra: 'intacta' };
        const target = { formA: { nota: '  y  ' }, formB };

        const result = SchemaConversionsApplier.execute({
            target,
            converted: { formA: { nota: 'y' }, formB: { otra: 'CONVERTIDA' } },
            dataStructure: {
                formA: { type: 'object', data_structure: { nota: { type: 'string', trim: true } } },
                formB: { type: 'object', data_structure: { otra: { type: 'string' } } },
            },
            patch: { formA: { nota: '  y  ' } },
        });

        expect(result.formB).toBe(formB);
        expect(result).not.toBe(target);
    });

    it('devuelve el mismo objeto cuando no hay nada que adoptar', () => {
        const target = { formA: { nota: 'y' } };

        const result = SchemaConversionsApplier.execute({
            target,
            converted: { formA: { nota: 'y' } },
            dataStructure: formAStructure({ nota: { type: 'string', trim: true } }),
            patch: { formA: { nota: 'y' } },
        });

        expect(result).toBe(target);
    });

    it('recorre los arrays por índice: sólo los ítems enviados heredan la conversión', () => {
        const result = SchemaConversionsApplier.execute({
            target: { formA: { tags: [{ nombre: '  a  ' }, { nombre: 'B_PERSISTIDO' }] } },
            converted: { formA: { tags: [{ nombre: 'a' }, { nombre: 'b_persistido' }] } },
            dataStructure: formAStructure({
                tags: {
                    type: 'array',
                    required: false,
                    data_structure: { nombre: { type: 'string', trim: true, transform: true, lowercase: true } },
                },
            }),
            patch: { formA: { tags: [{ nombre: '  a  ' }] } },
        });

        expect(result.formA.tags).toEqual([{ nombre: 'a' }, { nombre: 'B_PERSISTIDO' }]);
    });

    it('no adopta la conversión de una ruta que Joi reportó con error', () => {
        const result = SchemaConversionsApplier.execute({
            target: { formA: { nota: '  y  ', otra: 7 } },
            converted: { formA: { nota: 'y', otra: '7' } },
            dataStructure: formAStructure({
                nota: { type: 'string', trim: true },
                otra: { type: 'string' },
            }),
            patch: { formA: { nota: '  y  ', otra: 7 } },
            errorDetails: [{ path: ['formA', 'otra'], type: 'string.base' }],
        });

        expect(result).toEqual({ formA: { nota: 'y', otra: 7 } });
    });

    it('un error a nivel de objeto descarta la conversión de todas sus hojas', () => {
        const result = SchemaConversionsApplier.execute({
            target: { formA: { nota: '  y  ' } },
            converted: { formA: { nota: 'y' } },
            dataStructure: formAStructure({ nota: { type: 'string', trim: true } }),
            patch: { formA: { nota: '  y  ' } },
            errorDetails: [{ path: ['formA'], type: 'object.base' }],
        });

        expect(result.formA.nota).toBe('  y  ');
    });

    it.each([
        ['converted no es objeto', undefined],
        ['converted es null', null],
    ])('devuelve el target intacto cuando %s', (_label, converted) => {
        const target = { formA: { nota: 'y' } };
        expect(SchemaConversionsApplier.execute({ target, converted, dataStructure: notaYFecha })).toBe(target);
    });

    it('sin data_structure no adopta nada: no se puede resolver el tipo declarado', () => {
        const target = { formA: { nota: '  y  ' } };

        expect(SchemaConversionsApplier.execute({ target, converted: { formA: { nota: 'y' } } })).toBe(target);
    });

    it('integración con SchemaBuilder: aplica el transform sin materializar el default', () => {
        const dataStructure = formAStructure({
            nota: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
            apodo: { type: 'string', required: false, empty: true, default: 'sin-apodo' },
        });
        const target = { formA: { nota: '  hola  ' } };
        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, {
            abortEarly: false,
            allowUnknown: true,
        });

        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            errorDetails: error?.details,
        });

        expect(result).toEqual({ formA: { nota: 'HOLA' } });
    });
});

describe('SchemaConversionsApplier: la adopción depende del tipo DECLARADO, no de la ruta', () => {
    // El alcance del fix son los toggles trim/uppercase/lowercase de los campos string. La forma
    // convertida de un `date` (Date, ISO en UTC, o un número con `timestamp`) no siempre pasa su
    // propio esquema: adoptarla deja el registro ineditable.
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
        'una fecha que el patch SÍ envía se guarda tal como se envió (%s)',
        (_label, dateConfig, enviada) => {
            const dataStructure = formAStructure({
                nota: { type: 'string', required: false, empty: true, trim: true },
                fecha: { type: 'date', required: false, ...dateConfig },
            });
            const target = { formA: { nota: '  ana  ', fecha: enviada } };

            const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
            expect(error).toBeUndefined();

            const result = SchemaConversionsApplier.execute({
                target,
                converted: value,
                dataStructure,
            });

            expect(result.formA.fecha).toBe(enviada);
            expect(result.formA.nota).toBe('ana');
        }
    );

    it('el documento escrito vuelve a validar contra su propio esquema', () => {
        const dataStructure = formAStructure({
            nota: { type: 'string', required: false, empty: true, trim: true },
            fecha: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
            },
        });
        const target = { formA: { nota: 'ana', fecha: '2026-01-15T10:00:00' } };

        const { value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        const persisted = SchemaConversionsApplier.execute({ target, converted: value, dataStructure });

        const revalidation = SchemaBuilder.build(dataStructure).validate(persisted, { abortEarly: false });
        expect(revalidation.error).toBeUndefined();
    });

    it('por defecto no adopta la coerción de un number: se guarda lo enviado', () => {
        const dataStructure = formAStructure({ edad: { type: 'number', required: false } });
        const target = { formA: { edad: '41' } };

        const { value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        const result = SchemaConversionsApplier.execute({ target, converted: value, dataStructure });

        expect(result.formA.edad).toBe('41');
    });

    it('con la allowlist de origen texto adopta number y boolean, y no la fecha que no revalida', () => {
        const dataStructure = formAStructure({
            edad: { type: 'number', required: false },
            activo: { type: 'boolean', required: false },
            fecha: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
            },
        });
        const target = { formA: { edad: '41', activo: 'true', fecha: '2026-01-15T10:00:00' } };

        const { value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(result.formA).toEqual({ edad: 41, activo: true, fecha: '2026-01-15T10:00:00' });
    });

    // La decisión no la toma una lista de configuraciones de `date`, sino si el valor que se va a
    // escribir vuelve a validar contra el esquema de su propia hoja.
    //
    // `esperada` se deriva de `enviada` (en vez de un literal ISO hardcodeado) porque esta rama de
    // `DateSchemaBuilder` no fija un timezone propio: usa `new Date(val)`, que interpreta la
    // cadena en el TZ del proceso. Un literal fijo asume el TZ del CI (America/Bogota, ver
    // `.github/workflows/ci.yml`) y rompe en local con otro TZ. Mismo patrón que
    // `S3ImportsProcessorAuxNormalization.test.js`.
    it.each([
        ['legacy (sin config)', {}, '01/15/2026'],
        ['iso legacy', { iso: true }, '2026-01-15T10:00:00'],
    ])('con la allowlist de origen texto sí normaliza una fecha que revalida (%s)', (_l, config, enviada) => {
        const dataStructure = formAStructure({ fecha: { type: 'date', required: false, ...config } });
        const target = { formA: { fecha: enviada } };

        const { value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(JSON.parse(JSON.stringify(result)).formA.fecha).toBe(new Date(enviada).toISOString());
    });

    it.each([
        ['withoutTimezone + timezone', { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota' }],
        ['withTimezone + timestamp unix', { timezoneFormat: 'withTimezone', timestamp: 'unix' }],
        [
            'withoutTimezone + timestamp javascript',
            { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota', timestamp: 'javascript' },
        ],
    ])('con la allowlist de origen texto NO adopta la fecha cuya conversión no revalida (%s)', (_l, config) => {
        const enviada = config.timezoneFormat === 'withTimezone' ? '2026-01-15T10:00:00-05:00' : '2026-01-15T10:00:00';
        const dataStructure = formAStructure({ fecha: { type: 'date', required: false, ...config } });
        const target = { formA: { fecha: enviada } };

        const { value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(result.formA.fecha).toBe(enviada);
        const revalidation = SchemaBuilder.build(dataStructure).validate(JSON.parse(JSON.stringify(result)));
        expect(revalidation.error).toBeUndefined();
    });

    it('no adopta el valor de una clave que no está declarada en el data_structure', () => {
        const dataStructure = formAStructure({ nota: { type: 'string', trim: true } });
        const target = { formA: { nota: '  y  ', codigo_legado: '  OLD-9  ' } };

        const result = SchemaConversionsApplier.execute({
            target,
            converted: { formA: { nota: 'y', codigo_legado: 'OLD-9' } },
            dataStructure,
        });

        expect(result.formA).toEqual({ nota: 'y', codigo_legado: '  OLD-9  ' });
    });
});

describe('SchemaConversionsApplier: hojas con dependsOn', () => {
    // Bug reproducido: `isFixedPoint` construía el esquema de la hoja AISLADO con
    // `SchemaBuilder._buildSingle(node)`. Cuando la hoja tiene `dependency`/`dependsOn`,
    // `DependencyHelper.applyConditionalRequired` la envuelve en `Joi.when(Joi.ref(dependsOn), ...)`,
    // y esa referencia no resuelve fuera de su objeto padre: Joi lanzaba
    // "Invalid reference exceeds the schema root", el try/catch lo tragaba, y la conversión NUNCA
    // se adoptaba para ninguna hoja dependiente. El fix revalida dentro de un objeto sintético que
    // aporta el hermano (ver `SchemaBuilder.leafAccepts`).

    it('adopta un string trim+uppercase con dependsOn cuando la dependencia está satisfecha', () => {
        const dataStructure = formAStructure({
            requiereMotivo: { type: 'boolean', required: false },
            motivo: {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'requiereMotivo',
            },
        });
        const target = { formA: { requiereMotivo: true, motivo: '  cambio de horario  ' } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        const result = SchemaConversionsApplier.execute({ target, converted: value, dataStructure });

        expect(result.formA.motivo).toBe('CAMBIO DE HORARIO');
    });

    it('adopta un number con dependsOn cuando la dependencia está satisfecha', () => {
        const dataStructure = formAStructure({
            activarEdad: { type: 'boolean', required: false },
            edad: { type: 'number', required: false, dependency: true, dependsOn: 'activarEdad' },
        });
        const target = { formA: { activarEdad: true, edad: '41' } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(result.formA.edad).toBe(41);
    });

    it('adopta un boolean con dependsOn cuando la dependencia está satisfecha', () => {
        const dataStructure = formAStructure({
            activarFlag: { type: 'boolean', required: false },
            flag: { type: 'boolean', required: false, dependency: true, dependsOn: 'activarFlag' },
        });
        const target = { formA: { activarFlag: true, flag: 'true' } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(result.formA.flag).toBe(true);
    });

    it('adopta una fecha legacy con dependsOn en forma ISO cuando la dependencia está satisfecha', () => {
        const dataStructure = formAStructure({
            activarFecha: { type: 'boolean', required: false },
            fecha: { type: 'date', required: false, dependency: true, dependsOn: 'activarFecha' },
        });
        const enviada = '01/15/2026';
        const target = { formA: { activarFecha: true, fecha: enviada } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(JSON.parse(JSON.stringify(result)).formA.fecha).toBe(new Date(enviada).toISOString());
    });

    it('NO adopta una fecha withoutTimezone+timezone con dependsOn aunque la dependencia esté satisfecha', () => {
        // Es el caso que demuestra que el fix no se saltó la revalidación: si un fix perezoso
        // hubiese adoptado sin revalidar (por ejemplo "si dependsOn existe, adopta siempre"), esta
        // fecha se habría reescrito con una forma que ya no valida contra su propio esquema.
        const dataStructure = formAStructure({
            activarFecha: { type: 'boolean', required: false },
            fecha: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
                dependency: true,
                dependsOn: 'activarFecha',
            },
        });
        const enviada = '2026-01-15T10:00:00';
        const target = { formA: { activarFecha: true, fecha: enviada } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        const result = SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });

        expect(result.formA.fecha).toBe(enviada);
    });

    it('con dependencyValueValidation no lanza cuando el valor del padre no coincide (campo inactivo)', () => {
        const dataStructure = formAStructure({
            tipo: { type: 'string', required: false },
            motivo: {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'tipo',
                dependencyValueValidation: true,
                dependencyValue: 'especial',
            },
        });
        const target = { formA: { tipo: 'normal', motivo: '  x  ' } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, { abortEarly: false });
        expect(error).toBeUndefined();

        let result;
        expect(() => {
            result = SchemaConversionsApplier.execute({ target, converted: value, dataStructure });
        }).not.toThrow();

        expect(result.formA.motivo).toBe('  x  ');
    });

    it('no lanza cuando dependsOn apunta a un campo ausente del documento', () => {
        const dataStructure = formAStructure({
            motivo: {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'requiereMotivo',
            },
        });
        const target = { formA: { motivo: '  y  ' } };

        let result;
        expect(() => {
            result = SchemaConversionsApplier.execute({
                target,
                converted: { formA: { motivo: 'Y' } },
                dataStructure,
            });
        }).not.toThrow();

        expect(result).toBeDefined();
        expect(result.formA.motivo).toBeDefined();
    });

    it('no lanza con materializeDefaults cuando dependsOn apunta a un campo ausente', () => {
        const dataStructure = {
            motivo: {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'requiereMotivo',
                default: 'sin motivo',
            },
        };
        const target = {};

        let result;
        expect(() => {
            result = SchemaConversionsApplier.execute({
                target,
                converted: { motivo: 'sin motivo' },
                dataStructure,
                adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
                materializeDefaults: true,
            });
        }).not.toThrow();

        expect(result).toBeDefined();
    });
});

describe('SchemaConversionsApplier: materializeDefaults', () => {
    // Los `create` que validan contra la estructura COMPLETA (auxiliares generales e importación
    // CSV) sí deben persistir los `default()` del esquema: es lo que el administrador configuró
    // para un campo no diligenciado. Los `update` no, porque rellenarían claves que el registro
    // nunca tuvo.
    const conDefaults = {
        nombre: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
        estado: { type: 'string', required: false, empty: true, default: 'ABIERTO' },
        activo: { type: 'boolean', required: false, default: false },
        cantidad: { type: 'number', required: false, default: 0 },
    };

    const applyCreate = (target, dataStructure, options = {}) => {
        const { error, value } = SchemaBuilder.build(dataStructure).validate(target, {
            abortEarly: false,
            allowUnknown: true,
        });
        expect(error).toBeUndefined();

        return SchemaConversionsApplier.execute({
            target,
            converted: value,
            dataStructure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
            ...options,
        });
    };

    it('materializa los default de las claves ausentes, sea cual sea su tipo', () => {
        const result = applyCreate({ nombre: '  juan ' }, conDefaults, { materializeDefaults: true });

        expect(result).toEqual({ nombre: 'JUAN', estado: 'ABIERTO', activo: false, cantidad: 0 });
    });

    it('materializa el default de una fecha "now" en una forma que vuelve a validar', () => {
        const dataStructure = { registro: { type: 'date', required: false, default: 'now' } };

        const result = applyCreate({}, dataStructure, { materializeDefaults: true });

        expect(result.registro).toBeDefined();
        const revalidation = SchemaBuilder.build(dataStructure).validate(JSON.parse(JSON.stringify(result)));
        expect(revalidation.error).toBeUndefined();
    });

    it('materializa los default anidados de un formulario que el payload no envió completo', () => {
        const dataStructure = {
            formA: {
                type: 'object',
                required: false,
                data_structure: {
                    nota: { type: 'string', required: false, empty: true, trim: true },
                    estado: { type: 'string', required: false, empty: true, default: 'ABIERTO' },
                },
            },
        };

        const result = applyCreate({ formA: { nota: '  y  ' } }, dataStructure, { materializeDefaults: true });

        expect(result.formA).toEqual({ nota: 'y', estado: 'ABIERTO' });
    });

    it('no materializa el default de una fecha cuya forma convertida no revalida', () => {
        const dataStructure = {
            fecha: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
                default: '2026-01-15T10:00:00',
            },
        };

        const result = applyCreate({}, dataStructure, { materializeDefaults: true });

        expect(result.fecha).toBeUndefined();
    });

    it('no pisa un valor enviado con el default del esquema', () => {
        const result = applyCreate({ estado: 'CERRADO' }, conDefaults, { materializeDefaults: true });

        expect(result.estado).toBe('CERRADO');
    });

    it('sin la opción (camino de update) no materializa ningún default', () => {
        const result = applyCreate({ nombre: '  juan ' }, conDefaults);

        expect(result).toEqual({ nombre: 'JUAN' });
    });
});
