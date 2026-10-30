import { v4 as uuidv4 } from 'uuid';

import { knexConfig } from '../../../knexfile.js';
import { KnexCaseRepository } from '../../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { KnexStateRepository } from '../../../../src/state/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { KnexUsersRepository } from '../../../../src/users/index.js';
import { KnexClassificationRepository } from '../../../../src/classifications/index.js';
import { StateMother } from '../../../state/domain/StateMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';

describe('KnexCaseRepository.findReferenceLabels', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const stateRepo = new KnexStateRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    it('names users by their full name, skipping empty surnames', async () => {
        const camilo = await UsersMother.createUser(usersRepository, {
            nombres: 'Camilo',
            apellido1: 'Londoño',
            apellido2: '',
        });

        const labels = await repository.findReferenceLabels({ users: [camilo.id.value] });

        expect(labels.users).toEqual({ [camilo.id.value]: 'Camilo Londoño' });
    });

    it('names groups, states and classifications', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            nombre: 'Soporte Nivel Dos',
        });
        const state = await StateMother.createState(stateRepo, { nombre: 'Cerrado' });
        const classification = await ClassificationsMother.createClassification(classificationRepository, {
            nivel1: 'Quejas',
            nivel2: 'Facturación',
            nivel3: null,
            nivel4: null,
            nivel5: null,
            nivel6: null,
            nivel7: null,
            nivel8: null,
            nivel9: null,
            nivel10: null,
        });

        const labels = await repository.findReferenceLabels({
            groups: [group.id.value],
            states: [state.id.value],
            classifications: [classification.id.value],
        });

        expect(labels).toEqual({
            groups: { [group.id.value]: 'Soporte Nivel Dos' },
            states: { [state.id.value]: 'Cerrado' },
            classifications: { [classification.id.value]: 'Quejas -> Facturación' },
        });
    });

    it('omits ids that do not exist', async () => {
        const labels = await repository.findReferenceLabels({ users: [uuidv4()] });

        expect(labels.users).toEqual({});
    });

    it('ignores entities it does not know', async () => {
        const labels = await repository.findReferenceLabels({ clients: [uuidv4()] });

        expect(labels).toEqual({});
    });
});
