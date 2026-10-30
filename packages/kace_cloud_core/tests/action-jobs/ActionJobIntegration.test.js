import {
    ActionJobCreator,
    ActionJobFinder,
    ActionJobUpdater,
    ActionJobDeleter,
    ActionJobSearcher,
    ActionJobCounter,
    KnexActionJobRepository,
    ActionJobResponse,
    ActionJob,
    ActionJobCollectionResponse,
    DomainActionJobFinder,
    JobQueueProcessor,
    JobQueueFactory,
} from '../../src/action-jobs/index.js';
import ActionJobMother from './domain/ActionJobMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexActionJobProcessingRepository } from '../../src/action-job-processing/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexActionRepository } from '../../src/actions/index.js';
import { KnexActionUpdateModelRepository } from '../../src/action-update-model/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import ActionJobProcessingMother from '../action-job-processing/domain/ActionJobProcessingMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ActionUpdateModelMother from '../action-update-model/domain/ActionUpdateModelMother.js';
import ActionMother from '../actions/domain/ActionMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { AuxClientsMother } from '../aux_clientes/domain/AuxClientsMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexAuxClientsRepository } from '../../src/aux_clientes/index.js';
import { ValidationFailError } from '../../src/shared/index.js';

describe('ActionJob Integration Tests', () => {
    const repository = new KnexActionJobRepository(knexConfig);

    it('should create an ActionJob', async () => {
        const dto = ActionJobMother.dto();
        const actionJobCreator = new ActionJobCreator(repository);

        await actionJobCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing ActionJob', async () => {
        const actionJob = await ActionJobMother.create(repository);
        const actionJobFinder = new ActionJobFinder(repository);

        const result = await actionJobFinder.execute(actionJob.id.value);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ActionJobResponse);
    });

    it('can update an existing ActionJob', async () => {
        const actionJob = await ActionJobMother.create(repository);
        const actionJobUpdater = new ActionJobUpdater(repository);

        const newValues = { processed_records: 100, failed_records: 5 };
        await actionJobUpdater.execute(actionJob.id.value, newValues);

        const result = await repository.find(actionJob.id);

        expect(result).toBeInstanceOf(ActionJob);
        expect(result.processed_records.value).toBe(newValues.processed_records);
        expect(result.failed_records.value).toBe(newValues.failed_records);
    });

    it('can delete an existing ActionJob', async () => {
        const actionJob = await ActionJobMother.create(repository);
        const actionJobDeleter = new ActionJobDeleter(repository);

        await actionJobDeleter.execute(actionJob.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(actionJob.id);
        expect(result).toBeInstanceOf(ActionJob);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for ActionJobs with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionJobMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const actionJobSearcher = new ActionJobSearcher(repository);

        const searchResult = await actionJobSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(ActionJobCollectionResponse);
    });

    it('should throw an error when creating an existing ActionJob', async () => {
        const actionJob = await ActionJobMother.create(repository);
        const actionJobCreator = new ActionJobCreator(repository);

        const dto = { ...ActionJobMother.dto(), id: actionJob.id.value };
        await expect(actionJobCreator.execute(dto)).rejects.toThrow(
            new CustomError(`ActionJob with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to Domainfind an ActionJob with a non-existent ID', async () => {
        const domainActionJobFinder = new DomainActionJobFinder(repository);

        const actionJobResult = await domainActionJobFinder.execute(uuid());

        expect(actionJobResult).toEqual(null);
    });

    it('should throw an error when trying to find an ActionJob with a non-existent ID', async () => {
        const actionJobFinder = new ActionJobFinder(repository);

        await expect(actionJobFinder.execute(uuid())).rejects.toThrow('Action batch execution not found');
    });

    it('should throw an error when creating an ActionJob with invalid data', async () => {
        const dto = ActionJobMother.dto();
        delete dto.id;
        const actionJobCreator = new ActionJobCreator(repository);

        await expect(actionJobCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent ActionJob', async () => {
        const actionJobUpdater = new ActionJobUpdater(repository);
        const newValues = { is_in_progress: false };
        const nonExistentId = uuid();

        await expect(actionJobUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `ActionJob with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent ActionJob', async () => {
        const actionJobDeleter = new ActionJobDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            actionJobDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(`ActionJob with ID ${nonExistentId} does not exist.`);
    });

    it('should count ActionJob instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ActionJobMother.create(repository);
        }

        const counter = new ActionJobCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should process action job and update case correctly', async () => {
        const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
        const usersRepository = new KnexUsersRepository(repository.connection);
        const caseRepository = new KnexCaseRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const actionRepository = new KnexActionRepository(repository.connection);

        const user = await UsersMother.createUser(usersRepository);
        const kase = await CasesMother.createCase(caseRepository, {
            created_by: user.id.value,
        });
        const valueUpdate = 'Nuevo valor asignado';
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            field: 'motivo_baja',
            formula: null,
            type: 'alfanumerico',
            value: valueUpdate,
        });
        const action = await ActionMother.create(actionRepository, {
            action_type: 'actualizar_modelo',
            model_update_id: actionUpdateModel.id.value,
            responsible_id: null,
        });

        const actionJob = await ActionJobMother.create(repository);
        await ActionJobProcessingMother.create(actionJobProcessingRepository, {
            job_id: actionJob.id.value,
            action_id: action.id.value,
            case_id: kase.id.value,
        });

        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance: knexConfig });

        const jobQueueProcessor = new JobQueueProcessor(jobExecutionQueueService);
        const result = await jobQueueProcessor.execute();

        const jobProcessing = await actionJobProcessingRepository
            .connection(actionJobProcessingRepository.tableName)
            .select('*')
            .first();
        const kaseUpdated = await caseRepository.connection(caseRepository.tableName).select('*').first();

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(actionJob.id.value);
        expect(result.data.isCompleted).toBe(true);
        expect(kaseUpdated.motivo_baja).toBe(valueUpdate);
        expect(jobProcessing.details.attempts).toBe(1);
    });

    it('should process action job and update auxClient correctly', async () => {
        const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
        const clientRepository = new KnexClientRepository(repository.connection);
        const auxClientsRepository = new KnexAuxClientsRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const actionRepository = new KnexActionRepository(repository.connection);

        const client = await ClientMother.createClient(clientRepository);
        await AuxClientsMother.createAuxClient(auxClientsRepository, {
            cliente_id: client.id.value,
            data: { aux_cli: { noActivo: { activar: false } } },
        });
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            aggregate: 'AuxClient',
            field: 'aux_cli.noActivo.activar',
            formula: 'boolean_true',
        });
        const action = await ActionMother.create(actionRepository, {
            action_type: 'actualizar_modelo',
            model_update_id: actionUpdateModel.id.value,
            responsible_id: null,
        });

        const actionJob = await ActionJobMother.create(repository);
        await ActionJobProcessingMother.create(actionJobProcessingRepository, {
            job_id: actionJob.id.value,
            action_id: action.id.value,
            client_id: client.id.value,
        });

        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance: knexConfig });

        const jobQueueProcessor = new JobQueueProcessor(jobExecutionQueueService);
        const result = await jobQueueProcessor.execute();

        const jobProcessing = await actionJobProcessingRepository
            .connection(actionJobProcessingRepository.tableName)
            .select('*')
            .first();
        const auxClientUpdated = await auxClientsRepository
            .connection(auxClientsRepository.tableName)
            .select('*')
            .first();

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(actionJob.id.value);
        expect(result.data.isCompleted).toBe(true);
        expect(auxClientUpdated.data.aux_cli.noActivo.activar).toBeTruthy();
        expect(jobProcessing.details.attempts).toBe(1);
    });

    it('should create an ActionJob with restflow_id and restflow_context', async () => {
        const restflowId = uuid();
        const dto = ActionJobMother.dtoWithoutIdsData({ restflow_id: restflowId });
        const actionJobCreator = new ActionJobCreator(repository);
        await actionJobCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result[0].restflow_id).toBe(dto.restflow_id);
        // `restflow_context` es json en postgres: el driver ya devuelve el objeto.
        expect(result[0].restflow_context).toEqual(dto.restflow_context);
    });

    it('should throw ValidationFailError if both action_id and restflow_id are defined', async () => {
        const actionId = uuid();
        const restflowId = uuid();

        const dto = ActionJobMother.dtoWithoutIdsData({
            action_id: actionId,
            restflow_id: restflowId,
        });

        const actionJobCreator = new ActionJobCreator(repository);

        await expect(actionJobCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    it('should throw ValidationFailError if neither action_id nor restflow_id are defined', async () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'filter',
            action_id: null,
            restflow_id: null,
        });

        const actionJobCreator = new ActionJobCreator(repository);

        await expect(actionJobCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    it('should process action job with evaluate_conditions=true and execute action when conditions are met', async () => {
        const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
        const usersRepository = new KnexUsersRepository(repository.connection);
        const caseRepository = new KnexCaseRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const actionRepository = new KnexActionRepository(repository.connection);

        const user = await UsersMother.createUser(usersRepository);

        const kase = await CasesMother.createCase(caseRepository, {
            created_by: user.id.value,
            motivo_baja: 'Apply action',
        });

        const valueUpdate = 'Nuevo valor con validación';
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            field: 'motivo_baja',
            formula: null,
            type: 'alfanumerico',
            value: valueUpdate,
        });

        const action = await ActionMother.create(actionRepository, {
            action_type: 'actualizar_modelo',
            model_update_id: actionUpdateModel.id.value,
            responsible_id: null,
            conditions: {
                rules: [
                    {
                        type: 'manual_input',
                        field: 'cases.motivo_baja',
                        value: 'Apply action',
                        operator: '=',
                        value_type: 'text',
                        valueSource: 'value',
                    },
                ],
                combinator: 'and',
            },
        });

        const actionJob = await ActionJobMother.create(repository);

        await ActionJobProcessingMother.create(actionJobProcessingRepository, {
            job_id: actionJob.id.value,
            action_id: action.id.value,
            case_id: kase.id.value,
            evaluate_conditions: true,
        });

        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance: knexConfig });
        const jobQueueProcessor = new JobQueueProcessor(jobExecutionQueueService);
        const result = await jobQueueProcessor.execute();

        const jobProcessing = await actionJobProcessingRepository
            .connection(actionJobProcessingRepository.tableName)
            .select('*')
            .first();
        const kaseUpdated = await caseRepository.connection(caseRepository.tableName).select('*').first();

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(actionJob.id.value);
        expect(result.data.isCompleted).toBe(true);
        expect(kaseUpdated.motivo_baja).toBe(valueUpdate);
        expect(jobProcessing.details.attempts).toBe(1);
        expect(jobProcessing.evaluate_conditions).toBeTruthy();
    });

    it('should process action job with evaluate_conditions=true and skip action when conditions are not met', async () => {
        const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
        const usersRepository = new KnexUsersRepository(repository.connection);
        const caseRepository = new KnexCaseRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const actionRepository = new KnexActionRepository(repository.connection);

        const user = await UsersMother.createUser(usersRepository);

        const kase = await CasesMother.createCase(caseRepository, {
            created_by: user.id.value,
            motivo_baja: 'Do not apply action',
        });

        const valueUpdate = 'Este valor no debería aplicarse';
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            field: 'motivo_baja',
            formula: null,
            type: 'alfanumerico',
            value: valueUpdate,
        });

        const action = await ActionMother.create(actionRepository, {
            action_type: 'actualizar_modelo',
            model_update_id: actionUpdateModel.id.value,
            responsible_id: null,
            conditions: {
                rules: [
                    {
                        type: 'manual_input',
                        field: 'cases.motivo_baja',
                        value: 'Apply action',
                        operator: '=',
                        value_type: 'text',
                        valueSource: 'value',
                    },
                ],
                combinator: 'and',
            },
        });

        const actionJob = await ActionJobMother.create(repository);

        await ActionJobProcessingMother.create(actionJobProcessingRepository, {
            job_id: actionJob.id.value,
            action_id: action.id.value,
            case_id: kase.id.value,
            evaluate_conditions: true,
        });

        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance: knexConfig });
        const jobQueueProcessor = new JobQueueProcessor(jobExecutionQueueService);
        const result = await jobQueueProcessor.execute();

        const jobProcessing = await actionJobProcessingRepository
            .connection(actionJobProcessingRepository.tableName)
            .select('*')
            .first();
        const kaseUpdated = await caseRepository.connection(caseRepository.tableName).select('*').first();

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(actionJob.id.value);
        expect(result.data.isCompleted).toBe(true);
        expect(kaseUpdated.motivo_baja).toBe('Do not apply action');
        expect(jobProcessing.details.attempts).toBe(1);
        expect(jobProcessing.evaluate_conditions).toBeTruthy();
    });

    it('should process action job with evaluate_conditions=false and execute action without evaluating conditions', async () => {
        const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
        const usersRepository = new KnexUsersRepository(repository.connection);
        const caseRepository = new KnexCaseRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const actionRepository = new KnexActionRepository(repository.connection);

        const user = await UsersMother.createUser(usersRepository);

        const kase = await CasesMother.createCase(caseRepository, {
            created_by: user.id.value,
            motivo_baja: 'Do not apply action',
        });

        const valueUpdate = 'Este valor debería aplicarse sin evaluar condiciones';
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            field: 'motivo_baja',
            formula: null,
            type: 'alfanumerico',
            value: valueUpdate,
        });

        const action = await ActionMother.create(actionRepository, {
            action_type: 'actualizar_modelo',
            model_update_id: actionUpdateModel.id.value,
            responsible_id: null,
            conditions: {
                rules: [
                    {
                        type: 'manual_input',
                        field: 'cases.motivo_baja',
                        value: 'Apply action',
                        operator: '=',
                        value_type: 'text',
                        valueSource: 'value',
                    },
                ],
                combinator: 'and',
            },
        });

        const actionJob = await ActionJobMother.create(repository);

        await ActionJobProcessingMother.create(actionJobProcessingRepository, {
            job_id: actionJob.id.value,
            action_id: action.id.value,
            case_id: kase.id.value,
            evaluate_conditions: false,
        });

        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance: knexConfig });
        const jobQueueProcessor = new JobQueueProcessor(jobExecutionQueueService);
        const result = await jobQueueProcessor.execute();

        const jobProcessing = await actionJobProcessingRepository
            .connection(actionJobProcessingRepository.tableName)
            .select('*')
            .first();
        const kaseUpdated = await caseRepository.connection(caseRepository.tableName).select('*').first();

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(actionJob.id.value);
        expect(result.data.isCompleted).toBe(true);
        expect(kaseUpdated.motivo_baja).toBe(valueUpdate);
        expect(jobProcessing.details.attempts).toBe(1);
        expect(jobProcessing.evaluate_conditions).toBeFalsy();
    });
});
