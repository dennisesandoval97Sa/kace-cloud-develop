import {
    Ans,
    AnsCalculateResponse,
    AnsCalculator,
    AnsCollectionResponse,
    AnsCreator,
    AnsDeleter,
    AnsFinder,
    AnsResponse,
    AnsSearcher,
    AnsUpdater,
    KnexAnsRepository,
    Types,
} from '../../src/ans/index.js';
import AnsMother from './domain/AnsMother.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { CustomError } from '../../src/shared/index.js';
import ClientMother from '../clients/domain/ClientMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { ValidationFailError } from '../../src/shared/index.js';

describe('AnsCreator', () => {
    const repository = new KnexAnsRepository(knexConfig);

    it('creates a new Ans instance', async () => {
        const dto = AnsMother.dto();
        const ansCreator = new AnsCreator(repository);

        await ansCreator.execute(dto);

        const result = await repository.connection('ans').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('finds an existing Ans instance by id', async () => {
        const ans = await AnsMother.createAns(repository);
        const ansFinder = new AnsFinder(repository);

        const ansResult = await ansFinder.execute(ans.id.value);

        expect(ansResult).not.toBeNull();
        expect(ansResult).toBeInstanceOf(AnsResponse);
    });

    it('return null if not found a record', async () => {
        const ansFinder = new AnsFinder(repository);

        const ansResult = await ansFinder.execute(uuidv4());

        expect(ansResult).toBeNull();
    });

    it('updates an existing Ans instance with new name', async () => {
        const ans = await AnsMother.createAns(repository);
        const ansUpdater = new AnsUpdater(repository);

        await ansUpdater.execute(ans.id.value, { nombre: 'new name' });

        const result = await repository.find(ans.id);
        expect(result).toBeInstanceOf(Ans);
        expect(result.nombre.value).toBe('new name');
    });

    it('should throw CustomError if Ans to update does not exist', async () => {
        const nonExistentId = uuidv4();
        const ansUpdater = new AnsUpdater(repository);

        await expect(
            ansUpdater.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(new CustomError(`ANS with id ${nonExistentId} does not exist.`, 404));
    });

    it('deletes an existing Ans instance by id', async () => {
        const ans = await AnsMother.createAns(repository);
        const ansDeleter = new AnsDeleter(repository);

        await ansDeleter.execute(ans.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        const result = await repository.find(ans.id);
        expect(result).toBeInstanceOf(Ans);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('should throw CustomError if Ans to delete does not exist', async () => {
        const nonExistentId = uuidv4();
        const ansDeleter = new AnsDeleter(repository);

        await expect(
            ansDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(new CustomError(`ANS with id ${nonExistentId} does not exist.`, 404));
    });

    it('searches for Ans instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await AnsMother.createRandomAns(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const ansSearch = new AnsSearcher(repository);

        const ansResult = await ansSearch.execute(dtoCriteria);

        expect(ansResult).toBeInstanceOf(AnsCollectionResponse);
    });

    it('should return meta data in any search', async () => {
        for (let i = 0; i < 10; i++) {
            await AnsMother.createRandomAns(repository);
        }
        const dtoCriteria = {
            filter: null,
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const ansSearch = new AnsSearcher(repository);

        const ansResult = await ansSearch.execute(dtoCriteria);

        expect(ansResult).toBeInstanceOf(AnsCollectionResponse);
        expect(ansResult.toJson().data.items.length).toBe(10);
    });

    it('should throw an error when creating an ANS with a duplicate fields', async () => {
        const dto1 = AnsMother.dto();
        const dto2 = AnsMother.dto();
        dto2.intermedio = dto1.intermedio;
        dto2.vencido = dto1.vencido;
        dto2.medicion_ans_id = dto1.medicion_ans_id;

        const ansCreator = new AnsCreator(repository);
        await ansCreator.execute(dto1);
        await expect(ansCreator.execute(dto2)).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: intermedio '${dto2.intermedio}', vencido '${dto2.vencido}', medicion_ans_id '${dto2.medicion_ans_id}'.`
            )
        );
    });

    it('should throw an error when updating an ANS to have a duplicate fields', async () => {
        const ans1 = await AnsMother.createAns(repository);
        const ans2 = await AnsMother.createAns(repository);

        const ansUpdater = new AnsUpdater(repository);
        await expect(ansUpdater.execute(ans2.id.value, { intermedio: ans1.intermedio.value })).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: intermedio '${ans2.intermedio.value}', vencido '${ans2.vencido.value}', medicion_ans_id '${ans2.medicion_ans_id.value}'.`
            )
        );
    });

    it('Should throw an error when trying to create a new Ans instance with an intermediate value greater than the expired value', async () => {
        const dto = AnsMother.dto({ intermedio: 99, vencido: 45 });
        const ansCreator = new AnsCreator(repository);

        await expect(ansCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    it('Should throw an error when trying to update a new Ans instance with an intermediate value greater than the expired value', async () => {
        const ans = await AnsMother.createAns(repository);
        const ansUpdater = new AnsUpdater(repository);

        await expect(ansUpdater.execute(ans.id.value, { intermedio: 99, vencido: 45 })).rejects.toThrow(
            ValidationFailError
        );
    });

    it('rejects and keeps the ANS when only intermedio is sent and it reaches the stored vencido', async () => {
        const ans = await AnsMother.createAns(repository, { intermedio: 5, vencido: 10 });
        const ansUpdater = new AnsUpdater(repository);

        await expect(ansUpdater.execute(ans.id.value, { intermedio: 10 })).rejects.toThrow(ValidationFailError);

        const stored = await repository.find(ans.id);
        expect(stored.intermedio.value).toBe(5);
    });

    it('rejects and keeps the ANS when only vencido is sent and it drops to the stored intermedio', async () => {
        const ans = await AnsMother.createAns(repository, { intermedio: 5, vencido: 10 });
        const ansUpdater = new AnsUpdater(repository);

        await expect(ansUpdater.execute(ans.id.value, { vencido: 3 })).rejects.toThrow(ValidationFailError);

        const stored = await repository.find(ans.id);
        expect(stored.vencido.value).toBe(10);
    });
});

describe('CalculateAnsCases', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const transitionRepository = new KnexTransitionsRepository(caseRepository.connection);
    const ansRepository = new KnexAnsRepository(caseRepository.connection);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(caseRepository.connection);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);

    it('calculate ans must be have state elapsed properties', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const ans = await AnsMother.createAns(ansRepository);
        const transitions = await TransitionsMother.createTransition(
            transitionRepository,
            null,
            null,
            null,
            null,
            ans.id.value
        );
        const responsible = await UsersMother.createUser(userRepository);

        const classification = await ClassificationsMother.createClassification(
            classificationRepository,
            ClassificationsMother.dto({ ans_id: ans.id.value })
        );
        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);
        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);
        for (let i = 0; i < 5; i++) {
            await CasesMother.createCase(caseRepository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
                sla_state_id: ans.id.value,
            });
        }

        const ansCalculator = new AnsCalculator(caseRepository);
        const measurementType = Types.DAYS.value;
        await ansCalculator.execute({ measurementType });

        const rows = await caseRepository.connection('cases').select('*').first();

        expect(rows).toHaveProperty('state_elapsed_days');
        expect(typeof rows.state_elapsed_days).toBe('number');

        expect(rows).toHaveProperty('state_elapsed_hours');
        expect(typeof rows.state_elapsed_hours).toBe('number');

        expect(rows).toHaveProperty('state_elapsed_minutes');
        expect(typeof rows.state_elapsed_minutes).toBe('number');

        expect(rows).toHaveProperty('state_elapsed_time');
        expect(typeof rows.state_elapsed_time).toBe('string');
        expect(rows.state_elapsed_time.length).toBeLessThanOrEqual(100);
    });

    it('should calculate cases correctly', async () => {
        const client = await ClientMother.createClient(clientRepository);
        const ans = await AnsMother.createAns(ansRepository);
        const transitions = await TransitionsMother.createTransition(
            transitionRepository,
            null,
            null,
            null,
            null,
            ans.id.value
        );
        const responsible = await UsersMother.createUser(userRepository);
        const classification = await ClassificationsMother.createClassification(
            classificationRepository,
            ClassificationsMother.dto({ ans_id: ans.id.value })
        );
        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);
        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);
        for (let i = 0; i < 5; i++) {
            await CasesMother.createCase(caseRepository, {
                cliente_id: client.id.value,
                transicion_id: transitions.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });
        }

        const ansCalculator = new AnsCalculator(caseRepository);
        const measurementType = Types.DAYS.value;
        const ansResult = await ansCalculator.execute({ measurementType });

        expect(ansResult).not.toBeNull();
        expect(ansResult).toBeInstanceOf(AnsCalculateResponse);
    });

    it('should no throw error if cases are not found', async () => {
        const ansCalculator = new AnsCalculator(caseRepository);
        const measurementType = 'Days';

        expect((await ansCalculator.execute({ measurementType })).toJson().data.processedCases).toEqual(0);
    });

    it('should throw error if measurementType is not provided', async () => {
        const ansCalculator = new AnsCalculator(caseRepository);

        await expect(ansCalculator.execute({})).rejects.toThrow(Error);
    });

    it('should update cases correctly', async () => {
        for (let i = 0; i < 5; i++) {
            const client = await ClientMother.createClient(clientRepository);
            const ans = await AnsMother.createAns(ansRepository);
            const transitions = await TransitionsMother.createTransition(
                transitionRepository,
                null,
                null,
                null,
                null,
                ans.id.value
            );
            const responsible = await UsersMother.createUser(userRepository);
            const classification = await ClassificationsMother.createClassification(
                classificationRepository,
                ClassificationsMother.dto({ ans_id: ans.id.value })
            );
            const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);
            const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);
            for (let i = 0; i < 5; i++) {
                await CasesMother.createCase(caseRepository, {
                    cliente_id: client.id.value,
                    transicion_id: transitions.id.value,
                    responsable_id: responsible.id.value,
                    clasificacion_id: classification.id.value,
                    grupo_id: group.id.value,
                });
            }
        }

        const ansCalculator = new AnsCalculator(caseRepository);
        const measurementType = 'Days';
        await ansCalculator.execute({ measurementType });

        const updateFirstCase = await caseRepository.connection(caseRepository.tableName).select('*').first();

        expect(updateFirstCase.antiguedad).not.toBeNull();
        expect(updateFirstCase.ans_posicion).not.toBeNull();
        expect(updateFirstCase.antiguedad_dias).not.toBeNull();
        expect(updateFirstCase.antiguedad_horas).not.toBeNull();
        expect(updateFirstCase.expired_at).not.toBeNull();
        expect(updateFirstCase.remaining_time).not.toBeNull();
    });
});
