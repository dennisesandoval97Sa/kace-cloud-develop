import {
    Client,
    ClientCollectionResponse,
    ClientCreator,
    ClientDeleter,
    ClientFinder,
    ClientResponse,
    ClientSearcher,
    ClientUpdater,
    KnexClientRepository,
} from '../../src/clients/index.js';
import { knexConfig } from '../knexfile.js';
import ClientMother from './domain/ClientMother.js';
import { v4 as uuidv4 } from 'uuid';
import { ValidationFailError, InvalidArgumentError } from '../../src/shared/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '../../src/allowed-conections/index.js';
import { SecretReplacer } from '../../src/secrets-vault/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { SETTINGS } from '../global-config/domain/SettingsMother.js';

describe('Client Operations', () => {
    const repository = new KnexClientRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const globalConfigRepository = new KnexGlobalConfigurationRepository(knexConfig);
    const workflowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const secretRepository = new SecretReplacer();
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);

    it('should create an Client', async () => {
        const dto = ClientMother.dto();
        const clientCreator = new ClientCreator(repository);

        await clientCreator.execute(dto);

        const result = await repository.connection('clients').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('should throw an error if the id exists when creating the client', async () => {
        const client = await ClientMother.createClient(repository);
        const dto = ClientMother.dto();
        dto.id = client.id.value;
        const clientCreator = new ClientCreator(repository);

        await expect(clientCreator.execute(dto)).rejects.toThrowError(ValidationFailError);
    });

    it('should throw an error if the identification exists when creating the client', async () => {
        const client = await ClientMother.createClient(repository);
        const dto = ClientMother.dto();
        dto.tipo_documento = client.tipo_documento.value;
        dto.documento = client.documento.value;
        const clientCreator = new ClientCreator(repository);

        await expect(clientCreator.execute(dto)).rejects.toThrowError(ValidationFailError);
    });

    it('can retrieve an existing client', async () => {
        const client = await ClientMother.createClient(repository);
        const clientFinder = new ClientFinder(repository);

        const clientResult = await clientFinder.execute(client.id.value);

        expect(clientResult).not.toBeNull();
        expect(clientResult).toBeInstanceOf(ClientResponse);
    });

    it('can update an existing client', async () => {
        const client = await ClientMother.createClient(repository);
        const clientUpdater = new ClientUpdater(repository);

        const newValues = { campos_extra1: 'Modificado' };
        await clientUpdater.execute(client.id.value, newValues);

        const updatedClient = await repository.find(client.id);
        expect(updatedClient).toBeInstanceOf(Client);
        expect(updatedClient.campos_extra1.value).toBe(newValues.campos_extra1);
    });

    it('can delete an existing client', async () => {
        const client = await ClientMother.createClient(repository);
        const clientDeleter = new ClientDeleter(repository);

        await clientDeleter.execute(client.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const deletedClient = await repository.find(client.id);
        expect(deletedClient).toBeInstanceOf(Client);
        expect(deletedClient.deleted_at).not.toBeNull();
    });

    it('searches for clients instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ClientMother.createClient(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const currentUser = { id: { value: uuidv4() } };

        const clientSearch = new ClientSearcher(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        // Ejecutar sin idGrupoActivo para evitar el restflow
        const clientResult = await clientSearch.execute(dtoCriteria);

        expect(clientResult).toBeInstanceOf(ClientCollectionResponse);
        expect(clientResult.toJson().data.items.length).toBe(10);
    });

    it('executes restflow when idGrupoActivo is provided and group has configuration', async () => {
        for (let i = 0; i < 5; i++) {
            await ClientMother.createClient(repository);
        }

        const settings = {
            ...SETTINGS,
            custom_fields: {
                application: {
                    agente: {
                        execute_ws_restflow: true,
                        flow_id: 'test-workflow-id',
                    },
                },
            },
        };
        const configWithRestflow = await GlobalConfigurationsMother.createConfiguration(
            globalConfigRepository,
            settings
        );

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: configWithRestflow.id.value,
        });

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const currentUser = { id: { value: uuidv4() } };

        const clientSearch = new ClientSearcher(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        const clientResult = await clientSearch.execute(dtoCriteria, group.configuration_id);

        expect(clientResult).toBeInstanceOf(ClientCollectionResponse);
        expect(clientResult.toJson().data.items.length).toBe(5);
    });

    it('should create a Comercial Client', async () => {
        const dto = ClientMother.dtoComercial();
        await ClientMother.ensureRelations(repository.connection, dto);
        const clientCreator = new ClientCreator(repository);

        await clientCreator.execute(dto);

        const result = await repository.connection('clients').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('should throw a ValidationFailError when trying to create a Client with an existing ID', async () => {
        const client = await ClientMother.createClient(repository);
        const clientCreator = new ClientCreator(repository);

        await expect(clientCreator.execute(client.toJson())).rejects.toThrowError(ValidationFailError);
    });

    it('should successfully create a new client and return the created record with expected structure', async () => {
        const dto = ClientMother.dto();
        const clientCreator = new ClientCreator(repository);

        const savedClient = await clientCreator.execute(dto);

        expect(savedClient).toBeInstanceOf(ClientResponse);

        const json = savedClient.toJson();

        expect(json).toHaveProperty('data');

        // `fecha_nacimiento` es una columna `date`. El `returning('*')` del
        // insert la devuelve como medianoche del huso local, asi que el
        // instante exacto depende de la zona de la maquina y solo el dia del
        // calendario es comparable.
        const { fecha_nacimiento, ...fieldsWithoutDate } = dto;
        expect(json.data).toMatchObject(fieldsWithoutDate);

        const storedBirthDate = new Date(json.data.fecha_nacimiento);
        expect([storedBirthDate.getFullYear(), storedBirthDate.getMonth() + 1, storedBirthDate.getDate()]).toEqual([
            1979, 5, 7,
        ]);
        expect(fecha_nacimiento).toBe('1979-05-07T00:00:00.000Z');
    });

    it('should create a client with a nombres up to 300 characters', async () => {
        const longNombre = 'A'.repeat(300);
        const dto = ClientMother.dto(null, { nombres: longNombre });
        const clientCreator = new ClientCreator(repository);

        const savedClient = await clientCreator.execute(dto);

        expect(savedClient).toBeInstanceOf(ClientResponse);
        expect(savedClient.toJson().data.nombres).toBe(longNombre);
    });

    it('should throw an error when nombres exceeds 300 characters', async () => {
        const dto = ClientMother.dto(null, { nombres: 'A'.repeat(301) });
        const clientCreator = new ClientCreator(repository);

        await expect(clientCreator.execute(dto)).rejects.toThrowError(InvalidArgumentError);
    });

    // TODO: Generar test para edge cases
});
