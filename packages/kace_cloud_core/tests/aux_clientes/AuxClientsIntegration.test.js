import { v4 as uuidV4 } from 'uuid';
import {
    AuxClientResponse,
    AuxClientsCreator,
    AuxClientsFinder,
    AuxClientsUpdater,
    KnexAuxClientsRepository,
} from '../../src/aux_clientes/index.js';
import { knexConfig } from '../knexfile.js';
import { AuxClientsMother } from './domain/AuxClientsMother';
import { AuxClientsSearcher } from '../../src/aux_clientes/application/search/AuxClientsSearcher.js';

import ClientMother from '../clients/domain/ClientMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';

describe('Aux client test', () => {
    const auxClientsRepository = new KnexAuxClientsRepository(knexConfig);

    test('should create a new aux client', async () => {
        const dto = AuxClientsMother.dto();
        // El dto no pasa por `createAuxClient`, asi que el cliente padre hay
        // que respaldarlo aqui o postgres rechaza el insert.
        await AuxClientsMother.ensureRelations(auxClientsRepository.connection, dto);
        const auxClientCreator = new AuxClientsCreator(auxClientsRepository);

        await auxClientCreator.execute(dto);

        const auxClientCreated = await auxClientsRepository.connection('aux_clients').where('id', dto.id).first();

        expect(auxClientCreated.id).toEqual(dto.id);
        expect(auxClientCreated.cliente_id).toEqual(dto.cliente_id);
    });

    test('should update an existing aux client', async () => {
        const auxClientCreator = await AuxClientsMother.createAuxClient(auxClientsRepository);
        const auxClientUpdater = new AuxClientsUpdater(auxClientsRepository);
        const payload = {
            codigo: '123456',
            ciudad: auxClientCreator.data.value.ciudad,
            barrio: 'Alcaran 223',
            direccion: 'clle alcaran 33-34',
        };
        await auxClientUpdater.execute({ data: payload }, auxClientCreator.id.value);

        const auxClientUpdated = await auxClientsRepository
            .connection('aux_clients')
            .where('id', auxClientCreator.id.value)
            .first();

        expect(auxClientUpdated.data.codigo).toEqual(payload.codigo);
        expect(auxClientUpdated.data.ciudad).toEqual(payload.ciudad);
        expect(auxClientUpdated.data.barrio).toEqual(payload.barrio);
        expect(auxClientUpdated.data.direccion).toEqual(payload.direccion);
    });

    test('should update an existing aux client with nested data', async () => {
        const auxClientCreator = await AuxClientsMother.createAuxClient(auxClientsRepository);
        const auxClientUpdater = new AuxClientsUpdater(auxClientsRepository);
        const payload = {
            codigo: '123456',
            datos_alternos: {
                telefono: '658975',
            },
        };
        await auxClientUpdater.execute({ data: payload }, auxClientCreator.id.value);

        const auxClientUpdated = await auxClientsRepository
            .connection('aux_clients')
            .where('id', auxClientCreator.id.value)
            .first();

        expect(auxClientUpdated.data.codigo).toEqual(payload.codigo);
        expect(auxClientUpdated.data.datos_alternos.barrio).toBeDefined(payload.ciudad);
        expect(auxClientUpdated.data.datos_alternos.direccion).toBeDefined(payload.barrio);
        expect(auxClientUpdated.data.datos_alternos.telefono).toEqual(payload.datos_alternos.telefono);
    });

    test('should return an error when try update a non exist auxClient', async () => {
        const auxClientUpdater = new AuxClientsUpdater(auxClientsRepository);
        const payload = {
            codigo: '123456',
            ciudad: 'Bogota',
            barrio: 'Alcaran 223',
            direccion: 'clle alcaran 33-34',
        };
        await expect(auxClientUpdater.execute({ data: payload }, uuidV4())).rejects.toThrow();
    });

    test('can fetch a exist auxClient', async () => {
        const auxClientCreator = await AuxClientsMother.createAuxClient(auxClientsRepository);
        const auxClientFinder = new AuxClientsFinder(auxClientsRepository);
        const auxClient = await auxClientFinder.execute(auxClientCreator.cliente_id.value);
        const auxClientDataJson = auxClient.toJson();

        expect(auxClient).toBeInstanceOf(AuxClientResponse);
        expect(auxClientDataJson.data.id).toEqual(auxClientCreator.id.value);
    });

    test('should return a empty object when not exist an aux client', async () => {
        const auxClientFinder = new AuxClientsFinder(auxClientsRepository);
        const auxClient = await auxClientFinder.execute(uuidV4());

        expect(auxClient).toBeInstanceOf(AuxClientResponse);
        expect(auxClient.toJson()).toEqual({});
    });

    test('should have specific error message for duplicate cliente_id', async () => {
        const dto = AuxClientsMother.dto();
        await AuxClientsMother.ensureRelations(auxClientsRepository.connection, dto);
        const creator = new AuxClientsCreator(auxClientsRepository);
        await creator.execute(dto);

        await expect(creator.execute({ ...dto, id: uuidV4() })).rejects.toThrow(/already exists/);
    });

    test('should successfully create a new aux client and return the created record with expected structure', async () => {
        const auxClientsRepository = new KnexAuxClientsRepository(knexConfig);
        const auxClientCreator = new AuxClientsCreator(auxClientsRepository);

        const dto = AuxClientsMother.dto();
        await AuxClientsMother.ensureRelations(auxClientsRepository.connection, dto);
        const savedAuxClient = await auxClientCreator.execute(dto);
        const json = savedAuxClient.toJson();

        expect(json).toHaveProperty('data');
        expect(json.data).toMatchObject({
            id: dto.id,
            cliente_id: dto.cliente_id,
            data: dto.data,
            created_at: dto.created_at.toISOString(),
            created_by: dto.created_by,
        });
    });

    test('Should filter data with advanced filters used "jsonContains" operator and SeachService', async () => {
        const auxClientProductionRepository = new KnexAuxClientsRepository(knexConfig);
        const clientRepository = new KnexClientRepository(auxClientProductionRepository.connection);
        const searcher = new AuxClientsSearcher(auxClientProductionRepository);

        const auxTestData = {
            auxcli_campanya: {
                BASE_PRUEBAVALIDADOR: {
                    auxcli_ciiu: '',
                    auxcli_tel1: '',
                    auxcli_tel2: '',
                    auxcli_texto: '',
                    auxcli_activo: false,
                    auxcli_barrio: 'candelaria',
                    auxcli_ciudad: 'MEDELLIN',
                    auxcli_email1: '',
                    auxcli_email2: '',
                    auxcli_sector: '',
                    auxcli_ventas: '',
                    auxcli_celular1: '',
                    auxcli_celular2: '',
                    auxcli_cod_ciiu: '',
                    auxcli_segmento: '',
                    auxcli_region_of: '',
                    auxcli_subsector: '',
                    auxcli_tipo_cta1: '',
                    auxcli_tipo_cta2: '',
                    auxcli_tipo_cta3: '',
                    auxcli_act_econom: '',
                    auxcli_cta_numero1: '',
                    auxcli_cta_numero2: '',
                    auxcli_cta_numero3: '',
                    auxcli_subsegmento: '',
                    auxcli_departamento: 'ANTIOQUIA',
                    auxcli_potencial_qr: '',
                    auxcli_potencial_wompi: '',
                    auxcli_cliente_referido: '',
                    auxcli_fecha_vinculacion: '',
                    auxcli_correo_actualizado: '',
                    auxcli_fecha_actualizacion: '',
                    auxcli_potencial_adquirencia: '',
                    auxcli_direccion_alfanumerico: 'prueba',
                    auxcli_tel_contac_estrategico1: '',
                    auxcli_tel_contac_estrategico2: '',
                    auxcli_cargo_contac_estrategico1: '',
                    auxcli_cargo_contac_estrategico2: '',
                    auxcli_email_contac_estrategico1: '',
                    auxcli_email_contac_estrategico2: '',
                    auxcli_nombre_contac_estrategico1: '',
                    auxcli_nombre_contac_estrategico2: '',
                    auxcli_celular_contac_estrategico1: '',
                    auxcli_celular_contac_estrategico2: '',
                },
                CLIENTES_CREADOS_2025_07: {
                    auxcli_ciiu: '',
                    auxcli_tel1: '',
                    auxcli_tel2: '',
                    auxcli_texto: '',
                    auxcli_activo: true,
                    auxcli_barrio: 'candelaria',
                    auxcli_ciudad: 'MEDELLIN',
                    auxcli_email1: '',
                    auxcli_email2: '',
                    auxcli_sector: '',
                    auxcli_ventas: '',
                    auxcli_celular1: '',
                    auxcli_celular2: '',
                    auxcli_cod_ciiu: '',
                    auxcli_segmento: '',
                    auxcli_region_of: '',
                    auxcli_subsector: '',
                    auxcli_tipo_cta1: '',
                    auxcli_tipo_cta2: '',
                    auxcli_tipo_cta3: '',
                    auxcli_act_econom: '',
                    auxcli_cta_numero1: '',
                    auxcli_cta_numero2: '',
                    auxcli_cta_numero3: '',
                    auxcli_subsegmento: '',
                    auxcli_departamento: 'ANTIOQUIA',
                    auxcli_potencial_qr: '',
                    auxcli_potencial_wompi: '',
                    auxcli_cliente_referido: '',
                    auxcli_fecha_vinculacion: '',
                    auxcli_correo_actualizado: '',
                    auxcli_fecha_actualizacion: '',
                    auxcli_potencial_adquirencia: '',
                    auxcli_direccion_alfanumerico: 'prueba',
                    auxcli_tel_contac_estrategico1: '',
                    auxcli_tel_contac_estrategico2: '',
                    auxcli_cargo_contac_estrategico1: '',
                    auxcli_cargo_contac_estrategico2: '',
                    auxcli_email_contac_estrategico1: '',
                    auxcli_email_contac_estrategico2: '',
                    auxcli_nombre_contac_estrategico1: '',
                    auxcli_nombre_contac_estrategico2: '',
                    auxcli_celular_contac_estrategico1: '',
                    auxcli_celular_contac_estrategico2: '',
                },
            },
        };

        for (let iterator = 0; iterator < 5; iterator++) {
            const client = await ClientMother.createClient(clientRepository);
            // Sin `await` la busqueda corria contra las filas que hubieran
            // llegado a insertarse, no contra las cinco: el resultado dependia
            // de cuantas promesas sueltas habian resuelto para entonces.
            await AuxClientsMother.createAuxClient(
                auxClientProductionRepository,
                iterator % 2 === 0
                    ? { data: auxTestData, cliente_id: client.id.value }
                    : { cliente_id: client.id.value }
            );
        }

        const dtoCriteria = {
            relationship: [
                {
                    table: 'clients',
                    condition: {
                        column: 'clients.id',
                        refColumn: 'aux_clients.cliente_id',
                    },
                    type: 'left',
                },
            ],
            limit: 100,
            offset: 0,
            filter: [
                {
                    field: 'data',
                    operator: 'jsonContains',
                    value: '{"auxcli_campanya":{"BASE_PRUEBAVALIDADOR":{"auxcli_activo":false}}}',
                    type: 'AND',
                },
            ],
        };

        const results = await searcher.execute(dtoCriteria);
        expect(results.toJson().data.items.length).toBeGreaterThanOrEqual(3);

        results.toJson().data.items.forEach((item) => {
            expect(item.relations).toHaveProperty('clients');
        });
    });

    test('Should filter data with advanced filters used "jsonContains" operator and type "OR"', async () => {
        const auxClientProductionRepository = new KnexAuxClientsRepository(knexConfig);
        const clientRepository = new KnexClientRepository(auxClientProductionRepository.connection);
        const searcher = new AuxClientsSearcher(auxClientProductionRepository);

        const auxTestData = {
            auxcli_campanya: {
                BASE_PRUEBAVALIDADOR: {
                    auxcli_ciiu: '',
                    auxcli_tel1: '',
                    auxcli_tel2: '',
                    auxcli_texto: '',
                    auxcli_activo: false,
                    auxcli_barrio: 'candelaria',
                    auxcli_ciudad: 'MEDELLIN',
                    auxcli_email1: '',
                    auxcli_email2: '',
                    auxcli_sector: '',
                    auxcli_ventas: '',
                    auxcli_celular1: '',
                    auxcli_celular2: '',
                    auxcli_cod_ciiu: '',
                    auxcli_segmento: '',
                    auxcli_region_of: '',
                    auxcli_subsector: '',
                    auxcli_tipo_cta1: '',
                    auxcli_tipo_cta2: '',
                    auxcli_tipo_cta3: '',
                    auxcli_act_econom: '',
                    auxcli_cta_numero1: '',
                    auxcli_cta_numero2: '',
                    auxcli_cta_numero3: '',
                    auxcli_subsegmento: '',
                    auxcli_departamento: 'ANTIOQUIA',
                    auxcli_potencial_qr: '',
                    auxcli_potencial_wompi: '',
                    auxcli_cliente_referido: '',
                    auxcli_fecha_vinculacion: '',
                    auxcli_correo_actualizado: '',
                    auxcli_fecha_actualizacion: '',
                    auxcli_potencial_adquirencia: '',
                    auxcli_direccion_alfanumerico: 'prueba',
                    auxcli_tel_contac_estrategico1: '',
                    auxcli_tel_contac_estrategico2: '',
                    auxcli_cargo_contac_estrategico1: '',
                    auxcli_cargo_contac_estrategico2: '',
                    auxcli_email_contac_estrategico1: '',
                    auxcli_email_contac_estrategico2: '',
                    auxcli_nombre_contac_estrategico1: '',
                    auxcli_nombre_contac_estrategico2: '',
                    auxcli_celular_contac_estrategico1: '',
                    auxcli_celular_contac_estrategico2: '',
                },
                CLIENTES_CREADOS_2025_07: {
                    auxcli_ciiu: '',
                    auxcli_tel1: '',
                    auxcli_tel2: '',
                    auxcli_texto: '',
                    auxcli_activo: true,
                    auxcli_barrio: 'candelaria',
                    auxcli_ciudad: 'MEDELLIN',
                    auxcli_email1: '',
                    auxcli_email2: '',
                    auxcli_sector: '',
                    auxcli_ventas: '',
                    auxcli_celular1: '',
                    auxcli_celular2: '',
                    auxcli_cod_ciiu: '',
                    auxcli_segmento: '',
                    auxcli_region_of: '',
                    auxcli_subsector: '',
                    auxcli_tipo_cta1: '',
                    auxcli_tipo_cta2: '',
                    auxcli_tipo_cta3: '',
                    auxcli_act_econom: '',
                    auxcli_cta_numero1: '',
                    auxcli_cta_numero2: '',
                    auxcli_cta_numero3: '',
                    auxcli_subsegmento: '',
                    auxcli_departamento: 'ANTIOQUIA',
                    auxcli_potencial_qr: '',
                    auxcli_potencial_wompi: '',
                    auxcli_cliente_referido: '',
                    auxcli_fecha_vinculacion: '',
                    auxcli_correo_actualizado: '',
                    auxcli_fecha_actualizacion: '',
                    auxcli_potencial_adquirencia: '',
                    auxcli_direccion_alfanumerico: 'prueba',
                    auxcli_tel_contac_estrategico1: '',
                    auxcli_tel_contac_estrategico2: '',
                    auxcli_cargo_contac_estrategico1: '',
                    auxcli_cargo_contac_estrategico2: '',
                    auxcli_email_contac_estrategico1: '',
                    auxcli_email_contac_estrategico2: '',
                    auxcli_nombre_contac_estrategico1: '',
                    auxcli_nombre_contac_estrategico2: '',
                    auxcli_celular_contac_estrategico1: '',
                    auxcli_celular_contac_estrategico2: '',
                },
            },
        };

        for (let iterator = 0; iterator < 5; iterator++) {
            const client = await ClientMother.createClient(clientRepository);
            // Sin `await` la busqueda corria contra las filas que hubieran
            // llegado a insertarse, no contra las cinco: el resultado dependia
            // de cuantas promesas sueltas habian resuelto para entonces.
            await AuxClientsMother.createAuxClient(
                auxClientProductionRepository,
                iterator % 2 === 0
                    ? { data: auxTestData, cliente_id: client.id.value }
                    : { cliente_id: client.id.value }
            );
        }

        const dtoCriteria = {
            relationship: [
                {
                    table: 'clients',
                    condition: {
                        column: 'clients.id',
                        refColumn: 'aux_clients.cliente_id',
                    },
                    type: 'left',
                },
            ],
            limit: 100,
            offset: 0,
            filter: [
                {
                    field: 'data',
                    operator: 'jsonContains',
                    value: '{"auxcli_campanya":{"BASE_PRUEBAVALIDADOR":{"auxcli_activo":true}}}',
                    type: 'AND',
                },
                {
                    field: 'data',
                    operator: 'jsonContains',
                    value: '{"auxcli_campanya":{"BASE_PRUEBAVALIDADOR":{"auxcli_activo":false}}}',
                    type: 'OR',
                },
            ],
        };

        const results = await searcher.execute(dtoCriteria);
        expect(results.toJson().data.items.length).toBeGreaterThanOrEqual(3);

        results.toJson().data.items.forEach((item) => {
            expect(item.relations).toHaveProperty('clients');
        });
    });
});
