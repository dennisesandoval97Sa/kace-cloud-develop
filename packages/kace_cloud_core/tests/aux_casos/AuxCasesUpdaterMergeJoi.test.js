import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { AuxCases } from '../../src/aux_casos/domain/AuxCases.js';
import { AuxCasesUpdater } from '../../src/aux_casos/application/update/AuxCasesUpdater.js';
import { DeepMergeAuxiliariesData } from '../../src/shared/domain/services/DeepMergeAuxiliariesData.js';
import { ValidationFailError } from '../../src/shared/index.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const formAStructure = {
    formA: {
        type: 'object',
        required: true,
        data_structure: {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            nota: { type: 'string', required: false, empty: true },
            unidades: { type: 'number', required: false },
            tags: { type: 'array', required: false },
        },
    },
};

const buildHarness = (data) => {
    const userId = uuidv4();
    const auxCase = AuxCases.create({
        id: uuidv4(),
        caso_id: uuidv4(),
        data: clone(data),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        created_by: userId,
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        updated_by: userId,
    });
    const repository = {
        connection: () => {},
        tableName: 'aux_cases',
        find: jest.fn().mockResolvedValue(auxCase),
        update: jest.fn().mockResolvedValue(undefined),
        saveHistoryWithRelationships: jest.fn().mockResolvedValue(undefined),
    };
    const caseRepository = {
        find: jest.fn().mockResolvedValue({
            fecha_resolucion: null,
            cliente_id: { value: uuidv4() },
        }),
    };
    const updater = new AuxCasesUpdater(repository, caseRepository, null);
    updater.eventLogger = { log: jest.fn().mockResolvedValue(undefined) };
    return { updater, repository, auxCase, userId };
};

describe('AuxCasesUpdater merge-then-Joi', () => {
    it('accepts a nested sparse patch when the required sibling exists in persisted data', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2 },
        });
        await updater.execute(
            { data: { formA: { a: 9 } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value).toEqual({ formA: { a: 9, b: 2 } });
    });

    it('accepts a sparse patch when a required sibling is missing from persisted data', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1 },
        });
        await updater.execute(
            { data: { formA: { a: 9 } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value).toEqual({ formA: { a: 9 } });
    });

    it('rejects when the patch includes a required field with an invalid value', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2 },
        });
        const err = await updater
            .execute(
                { data: { formA: { a: 'not-a-number' } }, updated_at: new Date(), updated_by: userId },
                auxCase.id.value,
                formAStructure
            )
            .catch((error) => error);
        expect(err).toBeInstanceOf(ValidationFailError);
        expect(err.details?.[0]?.path).toEqual(expect.arrayContaining(['formA', 'a']));
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows unknown keys that exist only in persisted JSONB', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2, codigo_legado: 'OLD-99' },
        });
        await updater.execute(
            { data: { formA: { a: 9 } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.formA.codigo_legado).toBe('OLD-99');
        expect(auxCase.data.value.formA.a).toBe(9);
        expect(auxCase.data.value.formA.b).toBe(2);
    });

    it('keeps persisted 0 when the patch only updates a sibling', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2, unidades: 0, nota: 'sin daños' },
        });
        await updater.execute(
            { data: { formA: { nota: 'con daños leves' } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.formA.unidades).toBe(0);
        expect(auxCase.data.value.formA.nota).toBe('con daños leves');
    });

    it('replaces a dirty array when shouldOverrideArray is true', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2, tags: ['x'] },
        });
        await updater.execute(
            { data: { formA: { tags: ['x', 'y'] } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure,
            true
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.formA.tags).toEqual(['x', 'y']);
    });

    it('rejects when the merge would drop a required field that was present in persisted data', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2 },
        });
        const mergeSpy = jest.spyOn(DeepMergeAuxiliariesData, 'execute').mockReturnValue({ formA: { a: 9 } });

        const err = await updater
            .execute(
                { data: { formA: { a: 9 } }, updated_at: new Date(), updated_by: userId },
                auxCase.id.value,
                formAStructure
            )
            .catch((error) => error);

        mergeSpy.mockRestore();
        expect(err).toBeInstanceOf(ValidationFailError);
        expect(err.details?.[0]?.path).toEqual(expect.arrayContaining(['formA', 'b']));
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not validate an update with SchemaBuilder.buildPartial', async () => {
        const { updater, auxCase, userId } = buildHarness({
            formA: { a: 1, b: 2 },
        });
        const buildPartialSpy = jest.spyOn(SchemaBuilder, 'buildPartial');

        await updater.execute(
            { data: { formA: { a: 9 } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            formAStructure
        );

        expect(buildPartialSpy).not.toHaveBeenCalled();
        buildPartialSpy.mockRestore();
    });

    it('skips nested object required when the object key is absent from the patch', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1 },
            notes: 'old',
        });
        const dataStructure = {
            ...formAStructure,
            notes: { type: 'string', required: false, empty: true },
        };
        await updater.execute(
            { data: { notes: 'new' }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            dataStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value).toEqual({ formA: { a: 1 }, notes: 'new' });
    });

    it('skips a required array when the array key is absent from the patch', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({ notes: 'old' });
        const dataStructure = {
            tags: {
                type: 'array',
                required: true,
                data_structure: {
                    label: { type: 'string', required: true },
                },
            },
            notes: { type: 'string', required: false, empty: true },
        };
        await updater.execute(
            { data: { notes: 'new' }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            dataStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value).toEqual({ notes: 'new' });
    });

    it('skips a dirty persisted array item when the array key is absent from a touched form', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, items: [{ x: 'abc' }] },
        });
        const dataStructure = {
            formA: {
                type: 'object',
                required: true,
                data_structure: {
                    a: { type: 'number', required: true },
                    items: {
                        type: 'array',
                        required: false,
                        data_structure: {
                            x: { type: 'number', required: true },
                        },
                    },
                },
            },
        };
        await updater.execute(
            { data: { formA: { a: 2 } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            dataStructure
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.formA.a).toBe(2);
        expect(auxCase.data.value.formA.items).toEqual([{ x: 'abc' }]);
    });

    it('appends a new array row without revalidating a dirty persisted item', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1, items: [{ x: 'abc' }] },
        });
        const dataStructure = {
            formA: {
                type: 'object',
                required: true,
                data_structure: {
                    a: { type: 'number', required: true },
                    items: {
                        type: 'array',
                        required: false,
                        data_structure: {
                            x: { type: 'number', required: true },
                        },
                    },
                },
            },
        };
        await updater.execute(
            { data: { formA: { items: [{ x: 5 }] } }, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            dataStructure,
            false
        );
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(auxCase.data.value.formA.items).toEqual([{ x: 'abc' }, { x: 5 }]);
    });

    it('still rejects a required array when the patch sends an empty array', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({ notes: 'old' });
        const dataStructure = {
            tags: {
                type: 'array',
                required: true,
                data_structure: {
                    label: { type: 'string', required: true },
                },
            },
            notes: { type: 'string', required: false, empty: true },
        };
        const err = await updater
            .execute(
                { data: { tags: [] }, updated_at: new Date(), updated_by: userId },
                auxCase.id.value,
                dataStructure
            )
            .catch((error) => error);
        expect(err).toBeInstanceOf(ValidationFailError);
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('skips nested object and array required when dto.data is empty', async () => {
        const { updater, repository, auxCase, userId } = buildHarness({
            formA: { a: 1 },
            notes: 'same',
        });
        const dataStructure = {
            ...formAStructure,
            tags: {
                type: 'array',
                required: true,
                data_structure: {
                    label: { type: 'string', required: true },
                },
            },
            notes: { type: 'string', required: false, empty: true },
        };
        await updater.execute(
            { data: {}, updated_at: new Date(), updated_by: userId },
            auxCase.id.value,
            dataStructure
        );
        expect(repository.update).not.toHaveBeenCalled();
        expect(auxCase.data.value).toEqual({ formA: { a: 1 }, notes: 'same' });
    });
});

describe('AuxCasesUpdater string transforms (trim / lowercase / uppercase)', () => {
    const structureWith = (fieldConfig) => ({
        formA: {
            type: 'object',
            required: true,
            data_structure: {
                nota: { type: 'string', required: false, empty: true, ...fieldConfig },
                unidades: { type: 'number', required: false },
            },
        },
    });

    const runUpdate = async (harness, patch, structure) => {
        await harness.updater.execute(
            { data: { formA: patch }, updated_at: new Date(), updated_by: harness.userId },
            harness.auxCase.id.value,
            structure
        );
        return harness;
    };

    it('trim: recorta el valor entrante antes de persistir', async () => {
        const harness = buildHarness({ formA: { nota: 'previo' } });
        await runUpdate(harness, { nota: '  con espacios  ' }, structureWith({ trim: true }));
        expect(harness.repository.update).toHaveBeenCalledTimes(1);
        expect(harness.auxCase.data.value.formA.nota).toBe('con espacios');
    });

    it('lowercase: normaliza a minúsculas', async () => {
        const harness = buildHarness({ formA: { nota: 'previo' } });
        await runUpdate(harness, { nota: 'Hola MUNDO' }, structureWith({ transform: true, lowercase: true }));
        expect(harness.auxCase.data.value.formA.nota).toBe('hola mundo');
    });

    it('uppercase: normaliza a mayúsculas', async () => {
        const harness = buildHarness({ formA: { nota: 'previo' } });
        await runUpdate(harness, { nota: 'hola mundo' }, structureWith({ transform: true, uppercase: true }));
        expect(harness.auxCase.data.value.formA.nota).toBe('HOLA MUNDO');
    });

    it('trim + lowercase se aplican combinados', async () => {
        const harness = buildHarness({ formA: { nota: 'previo' } });
        await runUpdate(
            harness,
            { nota: '   MiXtO   ' },
            structureWith({ trim: true, transform: true, lowercase: true })
        );
        expect(harness.auxCase.data.value.formA.nota).toBe('mixto');
    });

    it('no altera hermanos de otro tipo ni claves desconocidas persistidas', async () => {
        const harness = buildHarness({ formA: { nota: 'x', unidades: 0, codigo_legado: 'OLD-9' } });
        await runUpdate(harness, { nota: '  Y  ' }, structureWith({ trim: true, transform: true, uppercase: true }));
        expect(harness.auxCase.data.value.formA).toMatchObject({
            nota: 'Y',
            unidades: 0,
            codigo_legado: 'OLD-9',
        });
    });

    it('idempotente: si el valor entrante sólo difiere en formato ya normalizado, es noop', async () => {
        const harness = buildHarness({ formA: { nota: 'hola' } });
        await runUpdate(harness, { nota: '  HOLA  ' }, structureWith({ trim: true, transform: true, lowercase: true }));
        expect(harness.repository.update).not.toHaveBeenCalled();
    });

    it('sana datos legados: persiste el valor normalizado aunque el patch sea igual al guardado', async () => {
        const harness = buildHarness({ formA: { nota: 'HOLA' } });
        await runUpdate(harness, { nota: 'HOLA' }, structureWith({ transform: true, lowercase: true }));
        expect(harness.repository.update).toHaveBeenCalledTimes(1);
        expect(harness.auxCase.data.value.formA.nota).toBe('hola');
    });

    it('un error no-bloqueante (required ausente en legado) no impide aplicar el transform a otros campos', async () => {
        const structure = {
            formA: {
                type: 'object',
                required: true,
                data_structure: {
                    nota: { type: 'string', required: false, empty: true, trim: true },
                    obligatorio: { type: 'string', required: true },
                },
            },
        };
        const harness = buildHarness({ formA: { nota: 'previo' } }); // 'obligatorio' nunca existió
        await runUpdate(harness, { nota: '  saneado  ' }, structure);
        expect(harness.repository.update).toHaveBeenCalledTimes(1);
        expect(harness.auxCase.data.value.formA.nota).toBe('saneado');
    });

    it('sin transforms declarados el valor se guarda tal cual', async () => {
        const harness = buildHarness({ formA: { nota: 'previo' } });
        await runUpdate(harness, { nota: '  Sin Cambios  ' }, structureWith({}));
        expect(harness.auxCase.data.value.formA.nota).toBe('  Sin Cambios  ');
    });
});

describe('AuxCasesUpdater: la escritura sólo difiere en las claves enviadas en el patch', () => {
    // Las 5 configuraciones de fecha soportadas por DateSchemaBuilder. Cuatro de ellas
    // convierten el valor entrante (a Date o a otro string ISO); si la escritura adoptara el
    // documento convertido completo, cada update reescribiría fechas que el patch no envió.
    const dateConfigs = [
        ['legacy (sin config)', {}],
        ['iso legacy', { iso: true }],
        ['withTimezone', { timezoneFormat: 'withTimezone' }],
        ['withoutTimezone + timezone', { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota' }],
        ['withoutTimezone sin timezone', { timezoneFormat: 'withoutTimezone' }],
        ['withTimezone + timestamp unix', { timezoneFormat: 'withTimezone', timestamp: 'unix' }],
        [
            'withoutTimezone + timestamp javascript',
            { timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota', timestamp: 'javascript' },
        ],
    ];

    const structureWithDate = (dateConfig) => ({
        formA: {
            type: 'object',
            required: false,
            data_structure: {
                nota: { type: 'string', required: false, empty: true, trim: true },
                fecha: { type: 'date', required: false, ...dateConfig },
            },
        },
    });

    const patchNota = (harness, nota, structure) =>
        harness.updater.execute(
            { data: { formA: { nota } }, updated_at: new Date(), updated_by: harness.userId },
            harness.auxCase.id.value,
            structure
        );

    it.each(dateConfigs)('no reescribe una fecha que el patch no envió (%s)', async (_label, dateConfig) => {
        const fechaOriginal =
            dateConfig.timezoneFormat === 'withTimezone' ? '2026-01-15T10:00:00-05:00' : '2026-01-15T10:00:00';
        const structure = structureWithDate(dateConfig);
        const harness = buildHarness({ formA: { nota: 'x', fecha: fechaOriginal } });

        await patchNota(harness, '  y  ', structure);

        expect(harness.auxCase.data.value.formA.nota).toBe('y');
        expect(harness.auxCase.data.value.formA.fecha).toBe(fechaOriginal);
    });

    it.each(dateConfigs)('el auxiliar sigue siendo editable tras dos updates (%s)', async (_label, dateConfig) => {
        const fechaOriginal =
            dateConfig.timezoneFormat === 'withTimezone' ? '2026-01-15T10:00:00-05:00' : '2026-01-15T10:00:00';
        const structure = structureWithDate(dateConfig);
        const harness = buildHarness({ formA: { nota: 'x', fecha: fechaOriginal } });

        await patchNota(harness, 'a', structure);
        await expect(patchNota(harness, 'b', structure)).resolves.not.toThrow();

        expect(harness.auxCase.data.value.formA.nota).toBe('b');
        expect(harness.auxCase.data.value.formA.fecha).toBe(fechaOriginal);
    });

    it.each(dateConfigs)(
        'una fecha que el patch SÍ envía se persiste intacta y el auxiliar sigue editable (%s)',
        async (_label, dateConfig) => {
            const fechaEnviada =
                dateConfig.timezoneFormat === 'withTimezone' ? '2026-01-15T10:00:00-05:00' : '2026-01-15T10:00:00';
            const structure = structureWithDate(dateConfig);
            const harness = buildHarness({ formA: { nota: 'previo' } });

            await harness.updater.execute(
                {
                    data: { formA: { nota: '  a  ', fecha: fechaEnviada } },
                    updated_at: new Date(),
                    updated_by: harness.userId,
                },
                harness.auxCase.id.value,
                structure
            );

            expect(harness.auxCase.data.value.formA.fecha).toBe(fechaEnviada);
            expect(harness.auxCase.data.value.formA.nota).toBe('a');

            // La edición siguiente sólo toca `nota`: no debe fallar por la fecha ya guardada.
            await expect(patchNota(harness, 'b', structure)).resolves.not.toThrow();
            expect(harness.auxCase.data.value.formA.fecha).toBe(fechaEnviada);
        }
    );

    it('no materializa el default de un campo que nunca se diligenció', async () => {
        const structure = {
            formA: {
                type: 'object',
                required: false,
                data_structure: {
                    nota: { type: 'string', required: false, empty: true, trim: true },
                    apodo: { type: 'string', required: false, empty: true, default: 'sin-apodo' },
                },
            },
        };
        const harness = buildHarness({ formA: { nota: 'x' } });

        await patchNota(harness, '  y  ', structure);

        expect(harness.auxCase.data.value.formA).toEqual({ nota: 'y' });
        expect(harness.auxCase.data.value.formA).not.toHaveProperty('apodo');
    });

    it('el documento persistido sólo cambia en las rutas enviadas por el patch', async () => {
        const structure = {
            formA: {
                type: 'object',
                required: false,
                data_structure: {
                    nota: { type: 'string', required: false, empty: true, trim: true },
                    fecha: { type: 'date', required: false, iso: true },
                    apodo: { type: 'string', required: false, empty: true, default: 'sin-apodo' },
                },
            },
            formB: {
                type: 'object',
                required: false,
                data_structure: {
                    otra_fecha: { type: 'date', required: false, iso: true },
                },
            },
        };
        const persisted = {
            formA: { nota: 'x', fecha: '2026-01-15T10:00:00' },
            formB: { otra_fecha: '2025-12-31T23:59:59' },
        };
        const harness = buildHarness(persisted);

        await patchNota(harness, '  y  ', structure);

        expect(harness.auxCase.data.value).toEqual({
            ...persisted,
            formA: { ...persisted.formA, nota: 'y' },
        });
    });

    it('no adopta el valor convertido de una ruta que falló la validación', async () => {
        // `obligatorio` nunca existió en el legado: su `any.required` es no bloqueante, pero el
        // patch sí lo envía vacío, así que su resultado de conversión no debe escribirse.
        const structure = {
            formA: {
                type: 'object',
                required: false,
                data_structure: {
                    nota: { type: 'string', required: false, empty: true, trim: true },
                    numero: { type: 'number', required: false },
                },
            },
        };
        const harness = buildHarness({ formA: { nota: 'previo', numero: 7 } });

        const err = await harness.updater
            .execute(
                {
                    data: { formA: { nota: '  saneado  ', numero: 'no-es-numero' } },
                    updated_at: new Date(),
                    updated_by: harness.userId,
                },
                harness.auxCase.id.value,
                structure
            )
            .catch((error) => error);

        expect(err).toBeInstanceOf(ValidationFailError);
        expect(harness.repository.update).not.toHaveBeenCalled();
        expect(harness.auxCase.data.value.formA.numero).toBe(7);
    });
});
