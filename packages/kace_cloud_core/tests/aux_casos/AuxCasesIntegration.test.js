import { v4 as uuidv4 } from 'uuid';
import {
    AuxCaseResponse,
    AuxCasesCreator,
    AuxCasesFinder,
    AuxCasesUpdater,
    KnexAuxCasesRepository,
} from '../../src/aux_casos/index.js';
import { knexConfig } from '../knexfile.js';
import { AuxCasesMother } from './domain/AuxCasesMother';
import { CustomError, TenantContext, ValidationFailError } from '../../src/shared/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { User } from '../../src/users/index.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { jest } from '@jest/globals';

describe('Aux case test', () => {
    const auxCaseRepository = new KnexAuxCasesRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(auxCaseRepository.connection);
    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    const dataStructure = {};

    it('should create a new aux case', async () => {
        const dto = AuxCasesMother.dto();
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        await auxCaseCreator.execute(dto, dataStructure);

        const auxCaseCreated = await auxCaseRepository.connection('aux_cases').where('id', dto.id).first();

        expect(auxCaseCreated.id).toEqual(dto.id);
        expect(auxCaseCreated.caso_id).toEqual(dto.caso_id);
    });

    it('should update an existing aux case', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: kase.id.value });
        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);
        const payload = {
            fecha_solicitud: new Date().toISOString(),
            tipo_usuario: auxCaseCreator.data.value.tipo_usuario,
            numero_pedido: auxCaseCreator.data.value.numero_pedido,
            canal_contacto: 'email',
            motivo_interaccion: 'PQR',
            spc: auxCaseCreator.data.value.spc,
            tiempo_solucion: '3',
        };
        await auxCaseUpdater.execute({ data: payload }, auxCaseCreator.id.value, dataStructure);

        const auxCaseUpdated = await auxCaseRepository
            .connection('aux_cases')
            .where('id', auxCaseCreator.id.value)
            .first();

        expect(auxCaseUpdated.data.fecha_solicitud).not.toBeNull();
        expect(auxCaseUpdated.data.canal_contacto).toEqual(payload.canal_contacto);
        expect(auxCaseUpdated.data.motivo_interaccion).toEqual(payload.motivo_interaccion);
        expect(auxCaseUpdated.data.tiempo_solucion).toEqual(payload.tiempo_solucion);
    });

    it('should update an existing aux case with nested data', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: kase.id.value });
        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);
        const payload = {
            progreso: {
                intermedio: true,
            },
            tiempo_solucion: '3',
        };
        await auxCaseUpdater.execute({ data: payload }, auxCaseCreator.id.value, dataStructure);

        const auxCaseUpdated = await auxCaseRepository
            .connection('aux_cases')
            .where('id', auxCaseCreator.id.value)
            .first();

        expect(auxCaseUpdated.data.fecha_solicitud).not.toBeNull();
        expect(auxCaseUpdated.data.progreso.inicio).toEqual(true);
        expect(auxCaseUpdated.data.progreso.intermedio).toEqual(true);
        expect(auxCaseUpdated.data.tiempo_solucion).toEqual(payload.tiempo_solucion);
    });

    it('should update only the incoming aux case fields and recalculate calculated fields on update', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const formId = 'form_20f33a74-8c68-4d1a-9d63-39e768e74dda';
        const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
            data: {
                [formId]: {
                    subtotal: 100,
                    impuestos: 16,
                },
            },
        });
        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

        const dataStructureWithCalc = {
            [formId]: {
                type: 'object',
                required: false,
                data_structure: {
                    subtotal: { type: 'number', required: true },
                    impuestos: { type: 'number', required: true },
                    total: {
                        type: 'calculated',
                        required: true,
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'sum(ref("subtotal"), ref("impuestos"))',
                            on: ['update'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        await auxCaseUpdater.execute(
            {
                data: {
                    [formId]: {
                        subtotal: 250,
                    },
                },
            },
            auxCaseCreator.id.value,
            dataStructureWithCalc
        );

        const updatedAuxCase = await auxCaseRepository
            .connection('aux_cases')
            .where('id', auxCaseCreator.id.value)
            .first();

        const formData = updatedAuxCase.data[formId];
        expect(formData.subtotal).toEqual(250);
        expect(formData.impuestos).toEqual(16);
        expect(formData.total).toEqual(266);
    });

    it('should return error when try update a not exist auxCase', async () => {
        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository);
        const payload = {
            fecha_solicitud: new Date().toISOString(),
            tipo_usuario: 'cliente',
            numero_pedido: '123456789',
            canal_contacto: 'email',
            motivo_interaccion: 'PQR',
            spc: 'spc',
            tiempo_solucion: '3',
        };

        await expect(auxCaseUpdater.execute({ data: payload }, uuidv4(), dataStructure)).rejects.toThrow(CustomError);
    });

    describe('executeJsonbUpdates()', () => {
        it('should correctly update specific nested paths without replacing the entire object', async () => {
            const kase = await CasesMother.createCase(caseRepository);
            const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, {
                caso_id: kase.id.value,
                data: { nested: { field_a: 10, field_b: 20 } },
            });
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

            const updates = [{ path: 'nested.field_a', value: 99 }];
            await auxCaseUpdater.executeJsonbUpdates(updates, auxCaseCreator.id.value, {});

            const auxCaseUpdated = await auxCaseRepository
                .connection('aux_cases')
                .where('id', auxCaseCreator.id.value)
                .first();

            expect(auxCaseUpdated.data.nested.field_a).toEqual(99);
            expect(auxCaseUpdated.data.nested.field_b).toEqual(20);
        });

        it('should not overwrite concurrent database writes to other fields when using jsonb_set', async () => {
            const kase = await CasesMother.createCase(caseRepository);
            const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, {
                caso_id: kase.id.value,
                data: { fields: { field1: 'val1', field2: 'val2' } },
            });

            await auxCaseRepository
                .connection('aux_cases')
                .where({ id: auxCaseCreator.id.value })
                .update({
                    data: JSON.stringify({ fields: { field1: 'val1', field2: 'val2_concurrent' } }),
                });

            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);
            const updates = [{ path: 'fields.field1', value: 'val1_updated' }];
            await auxCaseUpdater.executeJsonbUpdates(updates, auxCaseCreator.id.value, {});

            const finalAuxCase = await auxCaseRepository
                .connection('aux_cases')
                .where('id', auxCaseCreator.id.value)
                .first();

            expect(finalAuxCase.data.fields.field1).toEqual('val1_updated');
            expect(finalAuxCase.data.fields.field2).toEqual('val2_concurrent');
        });
    });

    it('can fetch a exist auxCase', async () => {
        const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository);
        const auxCaseFinder = new AuxCasesFinder(auxCaseRepository);
        const auxCase = await auxCaseFinder.execute(auxCaseCreator.caso_id.value);
        const auxCaseDataJson = auxCase.toJson();

        expect(auxCase).toBeInstanceOf(AuxCaseResponse);
        expect(auxCaseDataJson.data.id).toEqual(auxCaseCreator.id.value);
    });

    it('should return a empty object when not exist an aux case', async () => {
        const auxCaseFinder = new AuxCasesFinder(auxCaseRepository);
        const auxCase = await auxCaseFinder.execute(uuidv4());

        expect(auxCase).toBeInstanceOf(AuxCaseResponse);
        expect(auxCase.toJson()).toEqual({});
    });

    it('should throw error when creating aux case with duplicate caso_id', async () => {
        const dto = AuxCasesMother.dto();
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        await auxCaseCreator.execute(dto, dataStructure);

        const duplicateDto = {
            ...AuxCasesMother.dto(),
            caso_id: dto.caso_id,
        };

        await expect(auxCaseCreator.execute(duplicateDto)).rejects.toThrow(ValidationFailError);
    });

    it('should successfully create a new aux case and return the created record with expected structure', async () => {
        const auxCaseRepository = new KnexAuxCasesRepository(knexConfig);
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        expect(json).toHaveProperty('data');

        expect(json.data).toMatchObject({
            id: dto.id,
            caso_id: dto.caso_id,
            data: { ...dto.data, fecha_solicitud: dto.data.fecha_solicitud.toISOString() },
            created_at: dto.created_at.toISOString(),
            created_by: dto.created_by,
        });
    });

    it('should update aux case with nested structured form data', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const auxCaseCreator = await AuxCasesMother.createAuxCase(
            auxCaseRepository,
            { caso_id: kase.id.value },
            dataStructure
        );
        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

        const payload = {
            data: {
                'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                    user: 'david herrera',
                    NombreCliente: 'aaaaaaaaaaaa',
                    PlacaVehiculo: 'asd123',
                    FechaTentativaFinalizacionDeReparacion: '2025-08-22T23:00:00-05:00',
                    FuncionarioDelTaller: '21',
                    CausaSiniestro: 'prueba',
                    NumeroDelSiniestro: 1111111111111,
                    Historico: [
                        {
                            FechaTentativaDeInicioDeReparacionHistorico: '2025-08-20T23:00:00-05:00',
                            EstadoDelCaso: 'Caso creado línea de atención',
                            UsuarioDeModificacion: 'david herrera',
                        },
                        {
                            FechaTentativaDeInicioDeReparacionHistorico: '2025-08-21T23:00:00-05:00',
                            EstadoDelCaso: 'Caso creado línea de atención',
                            UsuarioDeModificacion: 'david herrera',
                        },
                    ],
                },
            },
        };

        await auxCaseUpdater.execute(payload, auxCaseCreator.id.value, dataStructure);

        const updatedAuxCase = await auxCaseRepository
            .connection('aux_cases')
            .where('id', auxCaseCreator.id.value)
            .first();

        const formData = updatedAuxCase.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(formData).toBeDefined();
        expect(formData.NombreCliente).toEqual('aaaaaaaaaaaa');
        expect(formData.PlacaVehiculo).toEqual('asd123');
        expect(formData.FuncionarioDelTaller).toEqual('21');
        expect(formData.CausaSiniestro).toEqual('prueba');
        expect(formData.NumeroDelSiniestro).toEqual(1111111111111);
        expect(formData.Historico).toBeInstanceOf(Array);
        expect(formData.Historico.length).toBeGreaterThan(1);
        expect(formData.Historico[0].FechaTentativaDeInicioDeReparacionHistorico).toEqual('2025-08-20T23:00:00-05:00');
    });

    it('should find aux case by external code', async () => {
        const externalCode = 'EXT-CODE-123';
        const kase = await CasesMother.createCase(caseRepository, { external_code: externalCode });

        const auxCaseCreated = await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
        });

        const foundAuxCase = await auxCaseRepository.findByCaseExternalCode(externalCode);

        expect(foundAuxCase).not.toBeNull();
        expect(foundAuxCase.id.value).toEqual(auxCaseCreated.id.value);
        expect(foundAuxCase.caso_id.value).toEqual(kase.id.value);
    });

    it('should return null when aux case with external code does not exist', async () => {
        const nonExistentExternalCode = 'NON-EXISTENT-CODE';

        const foundAuxCase = await auxCaseRepository.findByCaseExternalCode(nonExistentExternalCode);

        expect(foundAuxCase).toBeNull();
    });

    it('should not find aux case with deleted case', async () => {
        const externalCode = 'EXT-CODE-DELETED';
        const kase = await CasesMother.createCase(caseRepository, { external_code: externalCode });

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
        });

        await caseRepository.connection('cases').where('id', kase.id.value).update({ deleted_at: new Date() });

        const foundAuxCase = await auxCaseRepository.findByCaseExternalCode(externalCode);

        expect(foundAuxCase).toBeNull();
    });

    it('should throw error when creating aux case with existing external code', async () => {
        const externalCode = 'EXT-CODE-DUPLICATE';

        const firstCase = await CasesMother.createCase(caseRepository, { external_code: externalCode });
        await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: firstCase.id.value });

        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
        const dtoWithExternalCode = {
            ...AuxCasesMother.dto(),
            external_code: externalCode,
        };

        await expect(auxCaseCreator.execute(dtoWithExternalCode, dataStructure)).rejects.toThrow(ValidationFailError);

        await expect(auxCaseCreator.execute(dtoWithExternalCode, dataStructure)).rejects.toThrow(
            `External code ${externalCode} already exists`
        );
    });

    it('should successfully create aux case with unique external code', async () => {
        const uniqueExternalCode = 'UNIQUE-EXT-CODE-123';
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dtoWithExternalCode = {
            ...AuxCasesMother.dto(),
            external_code: uniqueExternalCode,
        };

        const result = await auxCaseCreator.execute(dtoWithExternalCode, dataStructure);

        expect(result).toBeInstanceOf(AuxCaseResponse);
        expect(result.toJson().data.id).toEqual(dtoWithExternalCode.id);
    });

    it('should create a new aux case with SUM calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                subtotal: 1000,
                impuestos: 160,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    subtotal: { type: 'number', required: true },
                    impuestos: { type: 'number', required: true },
                    suma_total: {
                        type: 'calculated',
                        required: true,
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'sum(ref("subtotal"), ref("impuestos"))',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.subtotal).toBe(1000);
        expect(formData.impuestos).toBe(160);
        expect(formData.suma_total).toBe(1160);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with SUB calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                    sub_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'sub(ref("a"), ref("b"))',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.sub_total).toBe(4);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with MUL calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                    mul_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'mul(ref("a"), ref("b"))',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.mul_total).toBe(21);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with DIV calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                    div_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'div(ref("a"), ref("b"))',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.div_total).toBe(2.3333333333);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with ROUND calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                precio: 19.955,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    precio: { type: 'number', required: true },
                    round_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'round(ref("precio"),2)',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.precio).toBe(19.955);
        expect(formData.round_total).toBe(19.96);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with MIN calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                    min_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'min(ref("a"), ref("b"))',
                            on: ['create'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.min_total).toBe(3);

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with MAX calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                    max_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'max(ref("a"), ref("b"))',
                            on: ['create'],
                            error_policy: 'error',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.max_total).toBe(7);

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with CONCAT calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                nombre: ' Ana ',
                apellido: 'López',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    nombre: { type: 'string', required: true },
                    apellido: { type: 'string', required: true },
                    concat_total: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'concat(trim(ref("nombre")), " ", ref("apellido"))',
                            on: ['create'],
                            error_policy: 'error',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.nombre).toBe(' Ana ');
        expect(formData.apellido).toBe('López');
        expect(formData.concat_total).toBe('Ana López');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with UPER calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                mensaje: 'Hola Mundo',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    mensaje: { type: 'string', required: true },
                    uper: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'upper(ref("mensaje"))',
                            on: ['create'],
                            error_policy: 'error',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.mensaje).toBe('Hola Mundo');
        expect(formData.uper).toBe('HOLA MUNDO');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with LOWER calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                mensaje: 'Hola Mundo',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: false,
                data_structure: {
                    mensaje: { type: 'string', required: true },
                    lower: {
                        required: true,
                        type: 'calculated',
                        ui: { input_type: 'number' },
                        calc: {
                            formula: 'lower(ref("mensaje"))',
                            on: ['create'],
                            error_policy: 'error',
                        },
                    },
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.mensaje).toBe('Hola Mundo');
        expect(formData.lower).toBe('hola mundo');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with TRIM calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                nombre: ' Ana ',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            nombre: { type: 'string', required: true },
            trim: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'number' },
                calc: {
                    formula: 'trim(ref("nombre"))',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.nombre).toBe(' Ana ');
        expect(formData.trim).toBe('Ana');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with SLICE calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                codigo: 'ABCDEF',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            codigo: { type: 'string', required: true },
            slice: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'number' },
                calc: {
                    formula: 'slice(ref("codigo"),0,3)',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.codigo).toBe('ABCDEF');
        expect(formData.slice).toBe('ABC');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with REF calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                rfc: 'ABC1234567890',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            rfc: { type: 'string', required: true },
            ref: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'ref("rfc")',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.rfc).toBe('ABC1234567890');
        expect(formData.ref).toBe('ABC1234567890');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with COALESCE calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            alias: { type: 'string', required: true },
            coalesce: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'coalesce(ref("alias"), "N/A")',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.coalesce).toBe('N/A');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with IF calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                subtotal: 1000,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            subtotal: { type: 'number', required: true },
            util_if: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'if(gt(ref("subtotal"), 500), "ALTO", "OK")',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.subtotal).toBe(1000);
        expect(formData.util_if).toBe('ALTO');

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with LEN calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                mensaje: 'Hola Mundo',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            mensaje: { type: 'string', required: true },
            len: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'len(ref("mensaje"))',
                    on: ['create'],
                    error_policy: 'error',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.mensaje).toBe('Hola Mundo');
        expect(formData.len).toBe(10);

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with EQ calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                pais: 'MX',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            pais: { type: 'string', required: true },
            equal: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'eq(ref("pais"),"MX")',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.pais).toBe('MX');
        expect(formData.equal).toBeTruthy();

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with NE calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                pais: 'US',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            pais: { type: 'string', required: true },
            ne: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'ne(ref("pais"),"MX")',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.pais).toBe('US');
        expect(formData.ne).toBeTruthy();

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with GT calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            gt: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'gt(ref("a"), ref("b"))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.gt).toBeTruthy();

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with GTE calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            gt: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'gte(ref("a"),7)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.gt).toBeTruthy();

        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with LT calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            b: { type: 'number', required: true },
            lt: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'lt(ref("b"),5)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.b).toBe(3);
        expect(formData.lt).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with LTE calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                b: 3,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            b: { type: 'number', required: true },
            lt: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'lte(ref("b"),3)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.b).toBe(3);
        expect(formData.lt).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with AND calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                pais: 'MX',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            pais: { type: 'string', required: true },
            and_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'and(eq(ref("pais"), "MX"), gt(ref("a"), ref("b")))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.pais).toBe('MX');
        expect(formData.and_funct).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with OR calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                pais: 'MX',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            pais: { type: 'string', required: true },
            or_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'or(eq(ref("pais"), "US"), gt(ref("a"), ref("b")))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.pais).toBe('MX');
        expect(formData.or_funct).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with NOT calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                pais: 'MX',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            pais: { type: 'string', required: true },
            not_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'not(eq(ref("pais"), "US"))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.pais).toBe('MX');
        expect(formData.not_funct).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with ADD DAYS calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: '2025-10-01',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            addDays_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'addDays(ref("fecha_emision"), 30)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe('2025-10-01');
        expect(formData.addDays_funct).toBe('2025-10-31T00:00:00.000Z');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with ADD MONTHS calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: '2025-10-01',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            addMonths_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'addMonths(ref("fecha_emision"), 1)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe('2025-10-01');
        expect(formData.addMonths_funct).toBe('2025-11-01T00:00:00.000Z');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with STARTS OF MONTH calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: '2025-10-10',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            startOfMonth: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'startOfMonth(ref("fecha_emision"))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe('2025-10-10');
        expect(formData.startOfMonth).toBe('2025-10-01T00:00:00.000Z');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with END OF MONTH calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: '2025-10-01',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            endOfMonth: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'endOfMonth(ref("fecha_emision"))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe('2025-10-01');
        expect(formData.endOfMonth).toBe('2025-10-31T23:59:59.999Z');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with DIFF DAYS calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: '2025-10-01',
                fecha_vencimiento: '2025-10-31',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            fecha_vencimiento: { type: 'string', required: true },
            diffDays: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'diffDays(ref("fecha_vencimiento"), ref("fecha_emision"))',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe('2025-10-01');
        expect(formData.fecha_vencimiento).toBe('2025-10-31');
        expect(formData.diffDays).toBe(30);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });
    it('should update aux case with nested structured form data and recalculate calculated fields', async () => {
        const kase = await CasesMother.createCase(caseRepository);
        const auxCaseCreator = await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
            data: {
                'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                    subtotal: 400,
                    NombreCliente: 'Juan Pérez',
                    mensaje: 'Hola Mundo',
                    Historico: [
                        {
                            FechaTentativaDeInicioDeReparacionHistorico: '2025-08-20T23:00:00-05:00',
                            EstadoDelCaso: 'Caso creado línea de atención',
                            UsuarioDeModificacion: 'david herrera',
                        },
                    ],
                },
            },
        });

        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

        const payload = {
            data: {
                'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                    subtotal: 600,
                    mensaje: 'Hola Universo',
                    user: 'david herrera',
                    NombreCliente: 'aaaaaaaaaaaa',
                    PlacaVehiculo: 'asd123',
                    FechaTentativaFinalizacionDeReparacion: '2025-08-22T23:00:00-05:00',
                    FuncionarioDelTaller: '21',
                    CausaSiniestro: 'prueba',
                    NumeroDelSiniestro: 1111111111111,
                    Historico: [
                        {
                            FechaTentativaDeInicioDeReparacionHistorico: '2025-08-20T23:00:00-05:00',
                            EstadoDelCaso: 'Caso creado línea de atención',
                            UsuarioDeModificacion: 'david herrera',
                        },
                        {
                            FechaTentativaDeInicioDeReparacionHistorico: '2025-08-21T23:00:00-05:00',
                            EstadoDelCaso: 'Caso creado línea de atención',
                            UsuarioDeModificacion: 'david herrera',
                        },
                    ],
                },
            },
        };

        await auxCaseUpdater.execute(payload, auxCaseCreator.id.value, {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                type: 'object',
                required: true,
                data_structure: {
                    subtotal: { type: 'number', required: true },
                    mensaje: { type: 'string', required: true },
                    util_if: {
                        type: 'calculated',
                        required: true,
                        calc: {
                            formula: 'if(gt(ref("subtotal"), 500), "ALTO", "OK")',
                            on: ['create', 'update'],
                            error_policy: 'error',
                        },
                    },
                    len: {
                        type: 'calculated',
                        required: true,
                        calc: { formula: 'len(ref("mensaje"))', on: ['create', 'update'], error_policy: 'error' },
                    },
                },
            },
        });

        const auxCaseUpdated = await auxCaseRepository
            .connection('aux_cases')
            .where('id', auxCaseCreator.id.value)
            .first();

        const formData = auxCaseUpdated.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(formData).toBeDefined();
        expect(formData.NombreCliente).toEqual('aaaaaaaaaaaa');
        expect(formData.PlacaVehiculo).toEqual('asd123');
        expect(formData.FuncionarioDelTaller).toEqual('21');
        expect(formData.CausaSiniestro).toEqual('prueba');
        expect(formData.NumeroDelSiniestro).toEqual(1111111111111);
        expect(formData.Historico).toBeInstanceOf(Array);
        expect(formData.Historico.length).toBeGreaterThan(1);
        expect(formData.Historico[0].FechaTentativaDeInicioDeReparacionHistorico).toEqual('2025-08-20T23:00:00-05:00');
        expect(formData.subtotal).toBe(600);
        expect(formData.mensaje).toBe('Hola Universo');
        expect(formData.util_if).toBe('ALTO');
        expect(formData.len).toBe(13);
    });

    it('should recalculate multiple calculated fields when dependent field is updated', async () => {
        const kase = await CasesMother.createCase(caseRepository);

        const dataStructure = {
            form_fechas: {
                type: 'object',
                required: false,
                data_structure: {
                    fecha_inicio: { type: 'string', required: true },
                    calculated_addMinutes: {
                        type: 'calculated',
                        required: true,
                        calc: {
                            formula: 'addMinutes(ref("fecha_inicio"), 30)',
                            on: ['create', 'update'],
                            error_policy: 'empty',
                        },
                    },
                    calculated_addHours: {
                        type: 'calculated',
                        required: true,
                        calc: {
                            formula: 'addHours(ref("fecha_inicio"), 12)',
                            on: ['create', 'update'],
                            error_policy: 'empty',
                        },
                    },
                    calculated_addDays: {
                        type: 'calculated',
                        required: true,
                        calc: {
                            formula: 'addDays(ref("fecha_inicio"), 5)',
                            on: ['create', 'update'],
                            error_policy: 'empty',
                        },
                    },
                    calculated_addMonths: {
                        type: 'calculated',
                        required: true,
                        calc: {
                            formula: 'addMonths(ref("fecha_inicio"), 3)',
                            on: ['create', 'update'],
                            error_policy: 'empty',
                        },
                    },
                },
            },
        };

        const initialDate = '2025-10-01T00:00:00.000Z';
        const updatedDate = '2025-12-15T00:00:00.000Z';

        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
        const dto = AuxCasesMother.dto({
            caso_id: kase.id.value,
            data: {
                form_fechas: {
                    fecha_inicio: initialDate,
                },
            },
        });

        await auxCaseCreator.execute(dto, dataStructure);

        const createdAuxCase = await auxCaseRepository.connection('aux_cases').where('id', dto.id).first();

        expect(createdAuxCase.data.form_fechas.fecha_inicio).toBe(initialDate);
        expect(createdAuxCase.data.form_fechas.calculated_addMinutes).toBe('2025-10-01T00:30:00.000Z');
        expect(createdAuxCase.data.form_fechas.calculated_addHours).toBe('2025-10-01T12:00:00.000Z');
        expect(createdAuxCase.data.form_fechas.calculated_addDays).toBe('2025-10-06T00:00:00.000Z');
        expect(createdAuxCase.data.form_fechas.calculated_addMonths).toBe('2026-01-01T00:00:00.000Z');

        const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

        await auxCaseUpdater.execute(
            {
                data: {
                    form_fechas: {
                        fecha_inicio: updatedDate,
                    },
                },
            },
            dto.id,
            dataStructure
        );

        const updatedAuxCase = await auxCaseRepository.connection('aux_cases').where('id', dto.id).first();

        expect(updatedAuxCase.data.form_fechas.fecha_inicio).toBe(updatedDate);
        expect(updatedAuxCase.data.form_fechas.calculated_addMinutes).toBe('2025-12-15T00:30:00.000Z');
        expect(updatedAuxCase.data.form_fechas.calculated_addHours).toBe('2025-12-15T12:00:00.000Z');
        expect(updatedAuxCase.data.form_fechas.calculated_addDays).toBe('2025-12-20T00:00:00.000Z');
        expect(updatedAuxCase.data.form_fechas.calculated_addMonths).toBe('2026-03-15T00:00:00.000Z');
    });

    it('should create a new aux case but skip calculated fields marked only for update', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                a: 7,
                b: 3,
                pais: 'MX',
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            a: { type: 'number', required: true },
            b: { type: 'number', required: true },
            pais: { type: 'string', required: true },
            not_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'not(eq(ref("pais"), "US"))',
                    on: ['update'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.a).toBe(7);
        expect(formData.b).toBe(3);
        expect(formData.pais).toBe('MX');
        expect(formData.not_funct).toBeNull();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with LTE calculated field using direct values and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            lt: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'lte(3,3)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.lt).toBeTruthy();
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with SUM calculated field using direct values and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                subtotal: 1000,
                impuestos: 200,
            },
        };

        const dataStructure = {
            total: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'number' },
                calc: {
                    formula: 'sum(1000, 200)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.total).toBe(1200);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with SUM calculated field using direct values and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                subtotal: 'hola',
                impuestos: 200,
            },
        };

        const dataStructure = {
            total: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'number' },
                calc: {
                    formula: 'sum("subtotal", "impuestos")',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.total).toBe(null);
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should create a new aux case with ADD DAYS timestamp calculated field and return expected result', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
        const day = '1761323267269';
        const dto = AuxCasesMother.dto();

        dto.data = {
            'form_20f33a74-8c68-4d1a-9d63-39e768e74dda': {
                fecha_emision: day,
                NombreCliente: 'Juan Pérez',
            },
        };

        const dataStructure = {
            fecha_emision: { type: 'string', required: true },
            addDays_funct: {
                required: true,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'addDays(ref("fecha_emision"), 30)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_20f33a74-8c68-4d1a-9d63-39e768e74dda'];

        expect(json).toHaveProperty('data');
        expect(formData.fecha_emision).toBe(day);
        expect(formData.addDays_funct).toBe('2025-11-23T16:27:47.269Z');
        expect(json.data.id).toEqual(dto.id);
        expect(json.data.caso_id).toEqual(dto.caso_id);
    });

    it('should return null and not throw when a date function receives missing parameters', async () => {
        TenantContext.getTenant = jest.fn().mockReturnValue({
            timezone: { value: 'UTC' },
        });

        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            form_test: {
                nombre: 'Luis',
            },
        };

        const dataStructure = {
            fecha: { type: 'date', required: false },

            fechaCalculada: {
                required: false,
                type: 'calculated',
                ui: { input_type: 'text' },
                calc: {
                    formula: 'addMinutes(ref("fecha"), 5)',
                    on: ['create'],
                    error_policy: 'empty',
                },
            },
        };

        const savedAuxCase = await auxCaseCreator.execute(dto, dataStructure);
        const json = savedAuxCase.toJson();

        const formData = json.data.data['form_test'];

        expect(formData.fechaCalculada).toBeNull();
    });

    it('should create calculated field when referenced fields are nested', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            asistencia_movilidad: {
                integracion_asistencia_movilidad: {
                    fecha_actual: '2026-03-28T10:04:25-05:00',
                    time_site: 10,
                },
            },
        };
        const dataStructure = {
            asistencia_movilidad: {
                type: 'object',
                required: false,
                data_structure: {
                    integracion_asistencia_movilidad: {
                        type: 'object',
                        required: false,
                        data_structure: {
                            fecha_actual: { type: 'date' },
                            time_site: { type: 'number' },
                            required: false,
                            caculate_fecha_y_hora_de_monitore_en_sitio: {
                                type: 'calculated',
                                required: false,
                                calc: {
                                    formula: 'addMinutes(ref("fecha_actual"), ref("time_site"))',
                                    on: ['create'],
                                    error_policy: 'empty',
                                },
                            },
                        },
                    },
                },
            },
        };

        const result = await auxCaseCreator.execute(dto, dataStructure);
        const json = result.toJson();

        const integracion = json.data.data.asistencia_movilidad.integracion_asistencia_movilidad;

        expect(integracion.caculate_fecha_y_hora_de_monitore_en_sitio).toBeDefined();
        expect(integracion.caculate_fecha_y_hora_de_monitore_en_sitio).toEqual('2026-03-28T15:14:25.000Z');
    });

    it('should calculate date using timezone defined in schema for nested fields', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            asistencia_movilidad: {
                integracion_asistencia_movilidad: {
                    fecha_actual: '2026-03-28T10:04:25',
                    time_site: 10,
                },
            },
        };

        const dataStructure = {
            asistencia_movilidad: {
                type: 'object',
                required: false,
                data_structure: {
                    integracion_asistencia_movilidad: {
                        type: 'object',
                        required: false,
                        data_structure: {
                            fecha_actual: {
                                type: 'date',
                                timezone: 'America/Bogota',
                            },
                            time_site: { type: 'number' },
                            caculate_fecha_y_hora_de_monitore_en_sitio: {
                                type: 'calculated',
                                required: false,
                                calc: {
                                    formula: 'addMinutes(ref("fecha_actual"), ref("time_site"))',
                                    on: ['create'],
                                    error_policy: 'empty',
                                },
                            },
                        },
                    },
                },
            },
        };

        const result = await auxCaseCreator.execute(dto, dataStructure);
        const json = result.toJson();

        const integracion = json.data.data.asistencia_movilidad.integracion_asistencia_movilidad;

        expect(integracion.caculate_fecha_y_hora_de_monitore_en_sitio).toBeDefined();

        expect(integracion.caculate_fecha_y_hora_de_monitore_en_sitio).toEqual('2026-03-28T15:14:25.000Z');
    });

    it('should NOT convert naive date when timezone is not defined in schema', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dto = AuxCasesMother.dto();

        dto.data = {
            asistencia_movilidad: {
                integracion_asistencia_movilidad: {
                    fecha_actual: '2026-03-28T10:04:25',
                    time_site: 10,
                },
            },
        };

        const dataStructure = {
            asistencia_movilidad: {
                type: 'object',
                required: false,
                data_structure: {
                    integracion_asistencia_movilidad: {
                        type: 'object',
                        required: false,
                        data_structure: {
                            fecha_actual: { type: 'date' },
                            time_site: { type: 'number' },
                            result: {
                                type: 'calculated',
                                calc: {
                                    formula: 'addMinutes(ref("fecha_actual"), ref("time_site"))',
                                    on: ['create'],
                                    error_policy: 'empty',
                                },
                            },
                        },
                    },
                },
            },
        };

        const result = await auxCaseCreator.execute(dto, dataStructure);
        const json = result.toJson();

        const integracion = json.data.data.asistencia_movilidad.integracion_asistencia_movilidad;

        expect(integracion.result).toEqual('2026-03-28T10:14:25.000Z');
    });

    it('should resolve dependency between calculated fields', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dataStructure = {
            form_test: {
                type: 'object',
                required: false,
                data_structure: {
                    a: {
                        required: true,
                        type: 'calculated',
                        calc: { formula: '10', on: ['create'] },
                    },
                    b: {
                        required: true,
                        type: 'calculated',
                        calc: { formula: 'sum(ref("a"), 5)', on: ['create'] },
                    },
                },
            },
        };

        const dto = AuxCasesMother.dto({ data: { form_test: {} } });

        const result = await auxCaseCreator.execute(dto, dataStructure);
        const form = result.toJson().data.data.form_test;

        expect(form.a).toBe(10);
        expect(form.b).toBe(15);
    });

    it('should resolve dependency from parent to nested', async () => {
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

        const dataStructure = {
            form_test: {
                type: 'object',
                required: false,
                data_structure: {
                    a: {
                        type: 'number',
                        required: true,
                    },
                    nested: {
                        type: 'object',
                        required: false,
                        data_structure: {
                            b: {
                                required: true,
                                type: 'calculated',
                                calc: {
                                    formula: 'sum(ref("a"), 5)',
                                    on: ['create'],
                                    error_policy: 'error',
                                },
                            },
                        },
                    },
                },
            },
        };

        const dto = AuxCasesMother.dto({
            data: {
                form_test: {
                    a: 10,
                    nested: {},
                },
            },
        });

        const result = await auxCaseCreator.execute(dto, dataStructure);
        const form = result.toJson().data.data.form_test;

        expect(form.a).toBe(10);
        expect(form.nested.b).toBe(15);
    });

    describe('unique calculated field — composite uniqueness via concat', () => {
        const FORM_ID = 'form_composite_unique';

        const compositeDataStructure = {
            [FORM_ID]: {
                type: 'object',
                required: false,
                data_structure: {
                    nombres: { type: 'string', required: true },
                    apellidos: { type: 'string', required: true },
                    nombre_completo: {
                        type: 'calculated',
                        required: false,
                        unique: true,
                        ui: { input_type: 'text' },
                        calc: {
                            formula: 'concat(ref("nombres"), " ", ref("apellidos"))',
                            on: ['create', 'update'],
                            error_policy: 'error',
                        },
                    },
                },
            },
        };

        it('should create an aux case with a unique composite calculated field', async () => {
            const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
            const dto = AuxCasesMother.dto({
                data: { [FORM_ID]: { nombres: 'Juan', apellidos: 'Pérez' } },
            });

            const result = await auxCaseCreator.execute(dto, compositeDataStructure);
            const form = result.toJson().data.data[FORM_ID];

            expect(form.nombre_completo).toBe('Juan Pérez');
        });

        it('should reject creating a second aux case with the same composite calculated value', async () => {
            const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

            const first = AuxCasesMother.dto({
                data: { [FORM_ID]: { nombres: 'Ana', apellidos: 'García' } },
            });
            await auxCaseCreator.execute(first, compositeDataStructure);

            const duplicate = AuxCasesMother.dto({
                data: { [FORM_ID]: { nombres: 'Ana', apellidos: 'García' } },
            });
            await expect(auxCaseCreator.execute(duplicate, compositeDataStructure)).rejects.toThrow(
                ValidationFailError
            );
        });

        it('should allow creating an aux case with a different composite calculated value', async () => {
            const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);

            const first = AuxCasesMother.dto({
                data: { [FORM_ID]: { nombres: 'Carlos', apellidos: 'López' } },
            });
            await auxCaseCreator.execute(first, compositeDataStructure);

            const different = AuxCasesMother.dto({
                data: { [FORM_ID]: { nombres: 'Carlos', apellidos: 'Martínez' } },
            });
            const result = await auxCaseCreator.execute(different, compositeDataStructure);
            const form = result.toJson().data.data[FORM_ID];

            expect(form.nombre_completo).toBe('Carlos Martínez');
        });

        it('should reject updating an aux case to a composite value that belongs to another record', async () => {
            const kase1 = await CasesMother.createCase(caseRepository);
            const kase2 = await CasesMother.createCase(caseRepository);
            const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, null);

            const first = AuxCasesMother.dto({
                caso_id: kase1.id.value,
                data: { [FORM_ID]: { nombres: 'María', apellidos: 'Torres' } },
            });
            await auxCaseCreator.execute(first, compositeDataStructure);

            const second = AuxCasesMother.dto({
                caso_id: kase2.id.value,
                data: { [FORM_ID]: { nombres: 'Pedro', apellidos: 'Ruiz' } },
            });
            const secondRecord = await auxCaseCreator.execute(second, compositeDataStructure);

            await expect(
                auxCaseUpdater.execute(
                    { data: { [FORM_ID]: { nombres: 'María', apellidos: 'Torres' } } },
                    secondRecord.toJson().data.id,
                    compositeDataStructure
                )
            ).rejects.toThrow(ValidationFailError);
        });

        it('should allow updating an aux case to its own composite value (self-exclude)', async () => {
            const kase = await CasesMother.createCase(caseRepository);
            const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, null);

            const dto = AuxCasesMother.dto({
                caso_id: kase.id.value,
                data: { [FORM_ID]: { nombres: 'Laura', apellidos: 'Sánchez' } },
            });
            const record = await auxCaseCreator.execute(dto, compositeDataStructure);

            await expect(
                auxCaseUpdater.execute(
                    { data: { [FORM_ID]: { nombres: 'Laura', apellidos: 'Sánchez' } } },
                    record.toJson().data.id,
                    compositeDataStructure
                )
            ).resolves.not.toThrow();
        });
    });

    describe('ALLOW_UPDATE_CLOSED_CASE flag (execute)', () => {
        it('allows updating an aux case of a resolved case when allowUpdateClosedCase is true', async () => {
            const kase = await CasesMother.createCase(caseRepository, {
                fecha_resolucion: new Date().toISOString(),
            });
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: kase.id.value });
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);
            const payload = {
                canal_contacto: 'email',
                motivo_interaccion: 'PQR',
                tiempo_solucion: '3',
            };

            await auxCaseUpdater.execute({ data: payload }, auxCase.id.value, dataStructure, false, [], {
                allowUpdateClosedCase: true,
            });

            const updated = await auxCaseRepository.connection('aux_cases').where('id', auxCase.id.value).first();
            expect(updated.data.canal_contacto).toEqual('email');
            expect(updated.data.motivo_interaccion).toEqual('PQR');
        });

        it('throws 403 for an aux case of a resolved case when allowUpdateClosedCase is false', async () => {
            const kase = await CasesMother.createCase(caseRepository, {
                fecha_resolucion: new Date().toISOString(),
            });
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: kase.id.value });
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

            await expect(
                auxCaseUpdater.execute({ data: { canal_contacto: 'email' } }, auxCase.id.value, dataStructure)
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('updates normally for an open case regardless of the flag', async () => {
            const kase = await CasesMother.createCase(caseRepository, { fecha_resolucion: null });
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepository, { caso_id: kase.id.value });
            const auxCaseUpdater = new AuxCasesUpdater(auxCaseRepository, caseRepository, currentUser);

            await auxCaseUpdater.execute(
                { data: { canal_contacto: 'chat' } },
                auxCase.id.value,
                dataStructure,
                false,
                [],
                {
                    allowUpdateClosedCase: false,
                }
            );

            const updated = await auxCaseRepository.connection('aux_cases').where('id', auxCase.id.value).first();
            expect(updated.data.canal_contacto).toEqual('chat');
        });
    });
});
