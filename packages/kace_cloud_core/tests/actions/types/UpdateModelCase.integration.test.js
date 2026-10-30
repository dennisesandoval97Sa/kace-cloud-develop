import { Action } from '../../../src/actions/index.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexActionUpdateModelRepository, Types } from '../../../src/action-update-model/index.js';
import { knexConfig } from '../../knexfile.js';
import { UpdateModelCase } from '../../../src/actions/domain/types/UpdateModelCase.js';
import { v4 as uuidv4 } from 'uuid';
import ActionMother from '../../actions/domain/ActionMother.js';
import ActionUpdateModelMother from '../../action-update-model/domain/ActionUpdateModelMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { ModelValueSaver } from '../../../src/actions/domain/ModelValueSaver.js';
import { KnexClientRepository } from '../../../src/clients/index.js';
import { KnexAuxCasesRepository } from '../../../src/aux_casos/index.js';
import { KnexAuxClientsRepository } from '../../../src/aux_clientes/index.js';
import ClassificationsMother from '../../classifications/domain/ClassificationsMother.js';
import AnsMother from '../../ans/domain/AnsMother.js';
import { KnexClassificationRepository } from '../../../src/classifications/index.js';
import { KnexAnsRepository } from '../../../src/ans/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../../src/global-config/index.js';
import { KnexSubcaseRelationshipRepository } from '../../../src/cases/index.js';
import { KnexShiftManagementRepository } from '../../../src/shift-management/index.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

describe('UpdateModelCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const actionUpdateModelRepository = new KnexActionUpdateModelRepository(caseRepository.connection);
    const formulaEvaluator = { execute: async () => 'value' };

    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(caseRepository.connection);
    const auxClientsRepository = new KnexAuxClientsRepository(caseRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(caseRepository.connection);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(caseRepository.connection);

    let classification, ans, group;
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const ansRepository = new KnexAnsRepository(caseRepository.connection);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(caseRepository.connection);
    const modelValueSaver = new ModelValueSaver(
        caseRepository,
        clientRepository,
        auxCasesRepository,
        auxClientsRepository,
        groupsRepository,
        globalConfigurationRepository,
        subcaseRelationshipRepository
    );

    const updateModelCase = new UpdateModelCase(
        caseRepository,
        actionUpdateModelRepository,
        formulaEvaluator,
        modelValueSaver
    );

    beforeEach(async () => {
        group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        ans = await AnsMother.createAns(ansRepository);
        classification = await ClassificationsMother.createClassification(classificationRepository, {
            ans_id: ans.id.value,
        });
    });

    it('should update the transition_id of the case when ActionUpdateModel specifies it', async () => {
        const expectedTransitionId = uuidv4();
        // La accion escribe este id en cases.transicion_id, que es FK real en postgres.
        await ensureParentRow(caseRepository.connection, 'transiciones', expectedTransitionId);
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            field: 'transicion_id',
            type: Types.ALFANUMERICO.value,
            value: expectedTransitionId,
        });

        const caseEntity = await CasesMother.createCase(caseRepository, {
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const action = Action.create(
            ActionMother.dto({
                model_update_id: actionUpdateModel.id.value,
            })
        );

        const result = await updateModelCase.execute(caseEntity, action);
        expect(result).toBe(true);

        const updatedCase = await caseRepository.find(caseEntity.id);
        expect(updatedCase?.transicion_id?.value).toBe(expectedTransitionId);
    });
});
