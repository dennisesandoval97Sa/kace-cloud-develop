import { describe, it, expect } from '@jest/globals';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';

// El editor de Esquemas es compartido: el mismo toggle trim/uppercase configura campos de
// auxiliares, de usuarios y de grupos. Estas pruebas fijan el contrato del camino de escritura
// de usuarios, que antes descartaba por completo el `value` convertido por Joi.
const dataStructure = {
    perfil: {
        type: 'object',
        required: false,
        data_structure: {
            documento: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
            alias: { type: 'string', required: false, empty: true, trim: true, transform: true, lowercase: true },
            ingreso: { type: 'date', required: false, iso: true, default: 'now' },
            sede: { type: 'string', required: false, empty: true, default: 'principal' },
        },
    },
};

describe('users actionCreate: camino de escritura del data_structure', () => {
    // Replica el flujo real del controller, incluida la copia superficial `dto = { ...data.value }`
    // tomada ANTES de validar: la normalización debe aterrizar en el objeto que se persiste.
    const runCreateWritePath = (payloadData) => {
        const data = { value: { data: payloadData } };
        const dto = { ...data.value };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(data.value.data);
        expect(error).toBeUndefined();

        dto.data = SchemaConversionsApplier.execute({ target: dto.data, converted: value, dataStructure });
        return dto;
    };

    it('normaliza los strings del esquema antes de persistir', () => {
        const dto = runCreateWritePath({ perfil: { documento: '  ab-12  ', alias: '  ANA  ' } });

        expect(dto.data.perfil).toEqual({ documento: 'AB-12', alias: 'ana' });
    });

    it('no materializa defaults de campos que el payload no envió', () => {
        const dto = runCreateWritePath({ perfil: { documento: 'ab-12' } });

        expect(dto.data.perfil).not.toHaveProperty('sede');
        expect(dto.data.perfil).not.toHaveProperty('ingreso');
    });

    it('la normalización llega al objeto persistido, no sólo a data.value', () => {
        const data = { value: { data: { perfil: { documento: '  ab-12  ' } } } };
        const dto = { ...data.value };

        const { value } = SchemaBuilder.build(dataStructure).validate(data.value.data);
        dto.data = SchemaConversionsApplier.execute({ target: dto.data, converted: value, dataStructure });

        expect(dto.data.perfil.documento).toBe('AB-12');
    });
});

describe('users actionUpdate: camino de escritura del data_structure', () => {
    // En update el controller valida con buildPartial acotado a las claves enviadas y persiste
    // `data.value`, que sí es el objeto pasado a UserUpdater.
    const runUpdateWritePath = (payloadData) => {
        const data = { value: { data: payloadData } };
        const partialKeys = Object.keys(data.value.data || {});
        const partialDs = SchemaBuilder.buildPartial(dataStructure, partialKeys);

        const { error, value } = SchemaBuilder.build(partialDs).validate(data.value.data, {
            abortEarly: false,
            context: { isUpdate: true },
        });
        expect(error).toBeUndefined();

        data.value.data = SchemaConversionsApplier.execute({
            target: data.value.data,
            converted: value,
            dataStructure: partialDs,
        });
        return data.value;
    };

    it('normaliza los strings enviados en el patch', () => {
        const written = runUpdateWritePath({ perfil: { alias: '  ANA MARÍA  ' } });

        expect(written.data.perfil.alias).toBe('ana maría');
    });

    it('no toca hermanos que el patch no envió', () => {
        const written = runUpdateWritePath({ perfil: { alias: 'ana' } });

        expect(written.data.perfil).toEqual({ alias: 'ana' });
    });
});

describe('users: una fecha enviada no cambia de valor ni de tipo al persistirse', () => {
    // En develop users descartaba por completo el `value` convertido: ninguna fecha cambiaba de
    // formato. Adoptar todas las hojas enviadas trasladaba aquí el defecto de los auxiliares —
    // con `withoutTimezone` o con `timestamp` el valor guardado ya no pasa su propio esquema y el
    // siguiente update falla sobre un campo que el usuario no tocó.
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

    it.each(dateConfigs)('create + siguiente update siguen siendo válidos (%s)', (_label, dateConfig, fecha) => {
        const structure = {
            perfil: {
                type: 'object',
                required: false,
                data_structure: {
                    documento: { type: 'string', required: false, empty: true, trim: true },
                    ingreso: { type: 'date', required: false, ...dateConfig },
                },
            },
        };
        const payloadData = { perfil: { documento: '  ab-12  ', ingreso: fecha } };

        const { error, value } = SchemaBuilder.build(structure).validate(payloadData);
        expect(error).toBeUndefined();

        const persisted = SchemaConversionsApplier.execute({
            target: payloadData,
            converted: value,
            dataStructure: structure,
        });

        expect(persisted.perfil.ingreso).toBe(fecha);
        expect(persisted.perfil.documento).toBe('ab-12');

        // El formulario reenvía lo que leyó: el update valida con buildPartial sobre esas claves.
        const partialDs = SchemaBuilder.buildPartial(structure, Object.keys(persisted));
        const revalidation = SchemaBuilder.build(partialDs).validate(persisted, {
            abortEarly: false,
            context: { isUpdate: true },
        });
        expect(revalidation.error).toBeUndefined();
    });
});
