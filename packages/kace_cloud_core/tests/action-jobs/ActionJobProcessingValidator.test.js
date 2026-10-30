import { Readable } from 'stream';
import { ActionJobProcessingValidator, S3FileParser } from '../../src/action-jobs/index.js';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexActionRepository } from '../../src/actions/index.js';
import { KnexActionJobProcessingRepository } from '../../src/action-job-processing/index.js';
import { v4 as uuidV4 } from 'uuid';

import CasesMother from '../cases/domain/CasesMother.js';
import ActionMother from '../actions/domain/ActionMother.js';

import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexActionUpdateModelRepository } from '../../src/action-update-model/index.js';
import { AuxClientsMother } from '../aux_clientes/domain/AuxClientsMother.js';
import { KnexAuxClientsRepository } from '../../src/aux_clientes/index.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows/index.js';

// Forma unica de la ejecucion masiva sobre clientes: base `clients` + auxiliar por join.
const auxClientsRelationship = {
    table: 'aux_clients',
    condition: {
        column: 'aux_clients.cliente_id',
        refColumn: 'clients.id',
    },
    type: 'left',
};

describe('ActionJobProcessingValidator', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const actionRepository = new KnexActionRepository(repository.connection);
    const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
    const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);

    const clientRepository = new KnexClientRepository(repository.connection);
    const transitionRepository = new KnexTransitionsRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);

    const auxClientRepository = new KnexAuxClientsRepository(repository.connection);
    const wsRestflowRepository = new KnexWSRestFlowRepository(repository.connection);

    let S3FileParserMock;
    /** @type {ActionJobProcessingValidator} */
    let actionJobService;

    let action1;
    let case1;
    let jobExecutionData;

    beforeEach(async () => {
        case1 = await CasesMother.createCase(repository);
        action1 = await ActionMother.create(actionRepository);
        S3FileParserMock = {
            readFile: (_fileKey) => Readable.from([`${case1.id.value},${action1.id.value}`]),
            parseCSV: (fileContent, delimiter = ',') => new S3FileParser().parseCSV(fileContent, delimiter),
        };
        actionJobService = new ActionJobProcessingValidator(
            repository,
            clientRepository,
            actionRepository,
            actionJobProcessingRepository,
            actionUpdateModelRepository,
            S3FileParserMock,
            wsRestflowRepository
        );

        jobExecutionData = {
            id: uuidV4(),
            type: 'file',
            s3_file_key: 'test_file.csv',
            details: { csv_config: { separator: ',', headers: false } },
            created_by: uuidV4(),
        };
    });

    describe('validateBatchFile', () => {
        it('should successfully validate and process a valid CSV file', async () => {
            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.errors).toHaveLength(0);
            expect(result.casesFailed).toBe(0);
            expect(result.processedCount).toBe(1);
        });

        it('should successfully save and process a valid CSV file', async () => {
            const result = await actionJobService.validateBatchFile(jobExecutionData, true);

            expect(result.errors).toHaveLength(0);
            expect(result.casesFailed).toBe(0);
            expect(result.processedCount).toBe(1);

            const savedExecutions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where('job_id', jobExecutionData.id)
                .select();

            expect(savedExecutions.length).toBe(1);
            expect(savedExecutions[0].case_id).toBe(case1.id.value);
            expect(savedExecutions[0].action_id).toBe(action1.id.value);
        });

        it('should process valid CSV data with action descriptions instead of UUIDs', async () => {
            S3FileParserMock.readFile = () => Readable.from([`${case1.id.value},${action1.description.value}`]);

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.processedCount).toBe(1);
            expect(result.errors.length).toBe(0);
        });

        it('should return an error if the CSV file is empty', async () => {
            S3FileParserMock.readFile = () => Readable.from([]);

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.errors).toEqual(['El archivo no contiene registros']);
            expect(result.processedCount).toBe(0);
        });

        it('should return an error if the case does not exist', async () => {
            S3FileParserMock.readFile = () => Readable.from([`invalid-case-id,${action1.id.value}`]);

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.errors).toContain(
                `Registro 1: El invalid-case-id no es válido. Debe ingresar el Id o la Referencia del caso`
            );
            expect(result.processedCount).toBe(1);
        });

        it('should return an error if the action does not exist', async () => {
            const fakeActionId = uuidV4();
            S3FileParserMock.readFile = () => Readable.from([`${case1.id.value},${fakeActionId}`]);

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.processedCount).toBe(1);
            expect(result.errors).toContain(`Registro 1: No se encontró ninguna acción con el dato: ${fakeActionId}`);
        });

        it('should return an error if the JSON content is invalid', async () => {
            S3FileParserMock.readFile = () => Readable.from([`${case1.id.value},${action1.id.value}|invalid-json`]);

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.processedCount).toBe(1);
            expect(result.errors).toContain(
                `Registro 1: Error al convertir los datos, no es JSON válido: invalid-json`
            );
        });

        it('should report error for file reading issues', async () => {
            S3FileParserMock.readFile = () => Promise.reject(new Error('File not found'));

            const result = await actionJobService.validateBatchFile(jobExecutionData);

            expect(result.processedCount).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toBe('S3File: File not found');
        });
    });

    describe('saveFilteredResults', () => {
        it('should successfully save filtered results', async () => {
            const client = await ClientMother.createClient(clientRepository);
            const transitions = await TransitionsMother.createTransition(transitionRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kaseRandom = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const search_filter = {
                filter: [{ type: 'AND', field: 'cases.id', value: kaseRandom.id.value, operator: 'eq' }],
                offset: 0,
                limit: 0,
            };
            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: action1.id.value,
                search_filter,
                created_by: uuidV4(),
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);
        });

        it('should return an error if no cases match the search criteria', async () => {
            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: action1.id.value,
                search_filter: {
                    filter: [{ type: 'AND', field: 'cases.id', value: uuidV4(), operator: 'eq' }],
                    offset: 0,
                    limit: 0,
                },
                created_by: uuidV4(),
            });

            expect(result.processedCount).toBe(0);
            expect(result.errors).toEqual(['No se encontraron casos que cumplan con los criterios de búsqueda.']);
        });

        it('should return an error if the action does not exist', async () => {
            const search_filter = {
                filter: [{ type: 'AND', field: 'cases.fecha_resolucion', value: 'null', operator: 'null' }],
                offset: 0,
                limit: 0,
            };

            const invalidActionId = uuidV4();
            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: invalidActionId,
                search_filter,
                created_by: uuidV4(),
            });

            expect(result.processedCount).toBe(0);
            // La busqueda va antes que la comprobacion de la accion, y con casos sembrados si
            // devuelve filas: el error que corresponde al nombre del test es el de la accion.
            expect(result.errors).toEqual([`No existe una acción/restflow con el id: ${invalidActionId}`]);
        });

        it('should successfully save filtered clients results', async () => {
            const repositoryPg = new KnexCaseRepository(knexConfig);

            const actionRepository = new KnexActionRepository(repositoryPg.connection);
            const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repositoryPg.connection);
            const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repositoryPg.connection);
            const clientRepository = new KnexClientRepository(repositoryPg.connection);
            const auxClientRepository = new KnexAuxClientsRepository(repositoryPg.connection);
            const wsRestflowRepository = new KnexWSRestFlowRepository(repositoryPg.connection);

            const actionJobService = new ActionJobProcessingValidator(
                repository,
                clientRepository,
                actionRepository,
                actionJobProcessingRepository,
                actionUpdateModelRepository,
                S3FileParserMock,
                wsRestflowRepository
            );

            const client = await ClientMother.createClient(clientRepository);

            // El filtro tiene que acotar por algo que viva dentro de `data`: un filtro sobre la
            // columna `cliente_id` se reescribe como `data ->> 'cliente_id'` y no encuentra nada
            // (ver `AuxiliaryColumnFieldHelper.COLUMN_FIELDS`, que no la incluye).
            const ciudad = `Medellin-${uuidV4()}`;
            await AuxClientsMother.createAuxClient(auxClientRepository, {
                cliente_id: client.id.value,
                data: { codigo: '123', ciudad },
            });

            const search_filter = {
                relationship: [auxClientsRelationship],
                limit: 100,
                offset: 0,
                filter: [
                    {
                        field: 'aux_clients.data',
                        operator: 'jsonContains',
                        value: JSON.stringify({ ciudad }),
                        type: 'AND',
                    },
                ],
            };

            const restflow = await WSRestFlowMother.create(wsRestflowRepository);
            const jobId = uuidV4();
            const result = await actionJobService.saveFilteredResults({
                id: jobId,
                action_id: null,
                search_filter,
                created_by: uuidV4(),
                restflow_id: restflow.id.value,
                type: 'filter_clients',
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);

            // El `client_id` debe ser el del cliente, no el de la fila auxiliar.
            const executions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where({ job_id: jobId });
            expect(executions).toHaveLength(1);
            expect(executions[0].client_id).toBe(client.id.value);
            expect(executions[0].case_id).toBeNull();
        });

        it('should filter clients by a native client column without any auxiliary row', async () => {
            const repositoryPg = new KnexCaseRepository(knexConfig);

            const actionRepository = new KnexActionRepository(repositoryPg.connection);
            const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repositoryPg.connection);
            const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repositoryPg.connection);
            const clientRepository = new KnexClientRepository(repositoryPg.connection);
            const wsRestflowRepository = new KnexWSRestFlowRepository(repositoryPg.connection);

            const actionJobService = new ActionJobProcessingValidator(
                repository,
                clientRepository,
                actionRepository,
                actionJobProcessingRepository,
                actionUpdateModelRepository,
                S3FileParserMock,
                wsRestflowRepository
            );

            /*
             * Sin sembrar `aux_clients`: con la tabla base anterior (`aux_clients`) este cliente
             * quedaba fuera del lote y el filtro `clients.documento` ni resolvia.
             */
            const client = await ClientMother.createClient(clientRepository);

            const search_filter = {
                relationship: [auxClientsRelationship],
                limit: 100,
                offset: 0,
                filter: [
                    {
                        field: 'clients.documento',
                        operator: 'eq',
                        value: client.documento.value,
                        type: 'AND',
                    },
                ],
            };

            const restflow = await WSRestFlowMother.create(wsRestflowRepository);
            const jobId = uuidV4();
            const result = await actionJobService.saveFilteredResults({
                id: jobId,
                action_id: null,
                search_filter,
                created_by: uuidV4(),
                restflow_id: restflow.id.value,
                type: 'filter_clients',
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);

            const executions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where({ job_id: jobId });
            expect(executions).toHaveLength(1);
            expect(executions[0].client_id).toBe(client.id.value);
        });

        it('should return a clients-specific error if no clients match the search criteria', async () => {
            const repositoryPg = new KnexCaseRepository(knexConfig);

            const actionRepository = new KnexActionRepository(repositoryPg.connection);
            const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repositoryPg.connection);
            const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repositoryPg.connection);
            const clientRepository = new KnexClientRepository(repositoryPg.connection);
            const wsRestflowRepository = new KnexWSRestFlowRepository(repositoryPg.connection);

            const actionJobService = new ActionJobProcessingValidator(
                repository,
                clientRepository,
                actionRepository,
                actionJobProcessingRepository,
                actionUpdateModelRepository,
                S3FileParserMock,
                wsRestflowRepository
            );

            const restflow = await WSRestFlowMother.create(wsRestflowRepository);
            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: null,
                search_filter: {
                    relationship: [auxClientsRelationship],
                    limit: 100,
                    offset: 0,
                    filter: [
                        {
                            field: 'clients.documento',
                            operator: 'eq',
                            value: 'non-existent-doc-999999',
                            type: 'AND',
                        },
                    ],
                },
                created_by: uuidV4(),
                restflow_id: restflow.id.value,
                type: 'filter_clients',
            });

            expect(result.processedCount).toBe(0);
            expect(result.errors).toEqual(['No se encontraron clientes que cumplan con los criterios de búsqueda.']);
        });
    });

    describe('saveFilteredResults with evaluate_conditions', () => {
        it('should save filtered results with evaluate_conditions=true', async () => {
            const client = await ClientMother.createClient(clientRepository);
            const transitions = await TransitionsMother.createTransition(transitionRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kaseRandom = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const search_filter = {
                filter: [{ type: 'AND', field: 'cases.id', value: kaseRandom.id.value, operator: 'eq' }],
                offset: 0,
                limit: 0,
            };

            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: action1.id.value,
                search_filter,
                created_by: uuidV4(),
                evaluate_conditions: true,
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);

            const savedExecutions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where('case_id', kaseRandom.id.value)
                .first();

            expect(savedExecutions).toBeDefined();
            expect(savedExecutions.evaluate_conditions).toBeTruthy();
        });

        it('should save filtered results with evaluate_conditions=false', async () => {
            const client = await ClientMother.createClient(clientRepository);
            const transitions = await TransitionsMother.createTransition(transitionRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kaseRandom = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const search_filter = {
                filter: [{ type: 'AND', field: 'cases.id', value: kaseRandom.id.value, operator: 'eq' }],
                offset: 0,
                limit: 0,
            };

            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: action1.id.value,
                search_filter,
                created_by: uuidV4(),
                evaluate_conditions: false,
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);

            const savedExecutions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where('case_id', kaseRandom.id.value)
                .first();

            expect(savedExecutions).toBeDefined();
            expect(savedExecutions.evaluate_conditions).toBeFalsy();
        });

        it('should save filtered results without evaluate_conditions when not specified', async () => {
            const client = await ClientMother.createClient(clientRepository);
            const transitions = await TransitionsMother.createTransition(transitionRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kaseRandom = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const search_filter = {
                filter: [{ type: 'AND', field: 'cases.id', value: kaseRandom.id.value, operator: 'eq' }],
                offset: 0,
                limit: 0,
            };

            const result = await actionJobService.saveFilteredResults({
                id: uuidV4(),
                action_id: action1.id.value,
                search_filter,
                created_by: uuidV4(),
            });

            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.casesFailed).toBe(0);

            const savedExecutions = await actionJobProcessingRepository
                .connection(actionJobProcessingRepository.tableName)
                .where('case_id', kaseRandom.id.value)
                .first();

            expect(savedExecutions).toBeDefined();
            expect(savedExecutions.evaluate_conditions).toBeNull();
        });
    });
});
