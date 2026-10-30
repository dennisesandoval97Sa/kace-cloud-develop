import { describe, it, expect } from '@jest/globals';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
    SchemaConversionsApplier,
    TEXT_SOURCE_ADOPTABLE_TYPES,
} from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';

// Los auxiliares generales son el otro consumidor del mismo editor de Esquemas. Su create valida
// contra la estructura COMPLETA, así que los `default` del esquema sí forman parte del registro
// guardado; su update sólo parchea las claves enviadas.
const dataStructure = {
    documento: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
    cantidad: { type: 'number', required: false },
    activo: { type: 'boolean', required: false, default: false },
    sede: { type: 'string', required: false, empty: true, default: 'principal' },
};

describe('auxiliaries actionCreate: camino de escritura del data_structure', () => {
    const runCreateWritePath = (payloadData, structure = dataStructure) => {
        const data = { value: { data: payloadData } };

        const { error, value } = SchemaBuilder.build(structure).validate(data.value.data, {
            abortEarly: false,
            allowUnknown: true,
        });
        expect(error).toBeUndefined();

        data.value.data = SchemaConversionsApplier.execute({
            target: data.value.data,
            converted: value,
            dataStructure: structure,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
            materializeDefaults: true,
        });
        return data.value.data;
    };

    it('normaliza los strings y la coerción del formulario', () => {
        const written = runCreateWritePath({ documento: '  ab-12  ', cantidad: '41' });

        expect(written).toMatchObject({ documento: 'AB-12', cantidad: 41 });
    });

    it('persiste los default del esquema para los campos no diligenciados', () => {
        const written = runCreateWritePath({ documento: 'ab-12' });

        expect(written.sede).toBe('principal');
        expect(written.activo).toBe(false);
    });

    it('no pisa con el default un valor que el formulario sí envió', () => {
        const written = runCreateWritePath({ documento: 'ab-12', sede: 'norte' });

        expect(written.sede).toBe('norte');
    });

    it.each([
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
    ])('lo guardado vuelve a validar, así que el registro sigue editable (%s)', (_label, dateConfig, fecha) => {
        const structure = {
            documento: { type: 'string', required: false, empty: true, trim: true },
            ingreso: { type: 'date', required: false, ...dateConfig },
        };

        const written = runCreateWritePath({ documento: '  ab-12  ', ingreso: fecha }, structure);
        const persisted = JSON.parse(JSON.stringify(written));

        const revalidation = SchemaBuilder.build(structure).validate(persisted, {
            abortEarly: false,
            context: { isUpdate: true },
        });
        expect(revalidation.error).toBeUndefined();
    });
});

describe('auxiliaries actionUpdate: camino de escritura del data_structure', () => {
    // El update valida con buildPartial sobre las claves enviadas y NO materializa defaults:
    // rellenarlos añadiría al registro claves que nunca tuvo.
    const runUpdateWritePath = (payloadData) => {
        const data = { value: { data: payloadData } };
        const partialDs = SchemaBuilder.buildPartial(dataStructure, Object.keys(data.value.data));

        const { error, value } = SchemaBuilder.build(partialDs).validate(data.value.data, {
            abortEarly: false,
            allowUnknown: true,
        });
        expect(error).toBeUndefined();

        data.value.data = SchemaConversionsApplier.execute({
            target: data.value.data,
            converted: value,
            dataStructure: partialDs,
            adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
        });
        return data.value.data;
    };

    it('normaliza los strings enviados en el patch', () => {
        expect(runUpdateWritePath({ documento: '  ab-12  ' })).toEqual({ documento: 'AB-12' });
    });

    it('no materializa defaults de claves que el patch no envió', () => {
        const written = runUpdateWritePath({ documento: 'ab-12' });

        expect(written).not.toHaveProperty('sede');
        expect(written).not.toHaveProperty('activo');
    });
});
