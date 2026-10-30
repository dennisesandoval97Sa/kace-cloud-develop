import { describe, it, expect } from '@jest/globals';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';

// Grupos es el tercer consumidor del mismo editor de Esquemas. Igual que usuarios, sólo adopta la
// normalización de los strings: una fecha se guarda tal como se envió, de modo que el siguiente
// update no falle sobre un campo que nadie tocó.
const dataStructure = {
    perfil: {
        type: 'object',
        required: false,
        data_structure: {
            codigo: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
            sede: { type: 'string', required: false, empty: true, default: 'principal' },
            ingreso: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
            },
        },
    },
};

describe('group actionCreate: camino de escritura del data_structure', () => {
    const runCreateWritePath = (payloadData) => {
        const data = { value: { data: payloadData } };

        const { error, value } = SchemaBuilder.build(dataStructure).validate(data.value.data);
        expect(error).toBeUndefined();

        data.value.data = SchemaConversionsApplier.execute({
            target: data.value.data,
            converted: value,
            dataStructure,
        });
        return data.value.data;
    };

    it('normaliza los strings del esquema antes de persistir', () => {
        expect(runCreateWritePath({ perfil: { codigo: '  ab-12  ' } })).toEqual({ perfil: { codigo: 'AB-12' } });
    });

    it('no materializa defaults ni reescribe la fecha enviada', () => {
        const written = runCreateWritePath({ perfil: { codigo: 'ab-12', ingreso: '2026-01-15T10:00:00' } });

        expect(written.perfil.ingreso).toBe('2026-01-15T10:00:00');
        expect(written.perfil).not.toHaveProperty('sede');
    });
});

describe('group actionUpdate: camino de escritura del data_structure', () => {
    const runUpdateWritePath = (payloadData) => {
        const data = { value: { data: payloadData } };
        const partialDs = SchemaBuilder.buildPartial(dataStructure, Object.keys(data.value.data));

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
        return data.value.data;
    };

    it('normaliza el patch y deja el documento válido para el siguiente update', () => {
        const written = runUpdateWritePath({ perfil: { codigo: '  ab-12  ', ingreso: '2026-01-15T10:00:00' } });

        expect(written.perfil.codigo).toBe('AB-12');

        const revalidation = SchemaBuilder.build(dataStructure).validate(JSON.parse(JSON.stringify(written)), {
            abortEarly: false,
            context: { isUpdate: true },
        });
        expect(revalidation.error).toBeUndefined();
    });
});
