import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';

describe('KnexCaseRepository — folio único', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    async function seedCase(overrides = {}) {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const transition = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        return CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            ...overrides,
        });
    }

    it('update() traduce la colisión de folio a un error de validación en vez de un 500', async () => {
        await seedCase({ folio: 'RAD-0001' });
        const other = await seedCase();
        const kase = await repository.find(other.id);

        kase.folio = 'RAD-0001';

        await expect(repository.update(kase)).rejects.toBeInstanceOf(ValidationFailError);
    });

    it('update() asigna un folio libre a un caso que no lo tenía', async () => {
        const created = await seedCase();
        const kase = await repository.find(created.id);

        kase.folio = 'RAD-0002';
        await repository.update(kase);

        const row = await repository.connection('cases').first('folio').where({ id: created.id.value });
        expect(row.folio).toBe('RAD-0002');
    });
});
