import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import {
    IdsValidator,
    KnexClassificationGroupRelationshipRepository,
} from '../../src/classification-group-relationships';
import { KnexClassificationRepository } from '../../src/classifications';
import { knexConfig } from '../knexfile.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { v4 as uuidv4 } from 'uuid';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import OneScriptMother from '../one-script/domain/OneScriptMother.js';
import { KnexOneScriptRepository } from '../../src/one-script/index.js';

describe('idsValidator Integration Tests', () => {
    const classificationGroupRepository = new KnexClassificationGroupRelationshipRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(knexConfig);
    const oneScriptRepository = new KnexOneScriptRepository(knexConfig);
    const idsValidator = new IdsValidator(classificationRepository, groupRepository, oneScriptRepository);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);

    it('should validate that all classification IDs exist', async () => {
        const classifications = [];
        for (let i = 0; i < 3; i++) {
            const dto = ClassificationsMother.dto();
            await ClassificationsMother.createClassification(classificationRepository, dto);
            classifications.push(dto);
        }

        const classificationIds = classifications.map((classification) => classification.id);
        await expect(idsValidator.validateClassificationIds(classificationIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more classification IDs do not exist', async () => {
        const classifications = [];
        for (let i = 0; i < 2; i++) {
            const dto = ClassificationsMother.dto();
            await ClassificationsMother.createClassification(classificationRepository, dto);
            classifications.push(dto);
        }

        const nonExistentclassificationId = uuidv4();
        const classificationIds = classifications.map((classification) => classification.id);
        classificationIds.push(nonExistentclassificationId);

        await expect(idsValidator.validateClassificationIds(classificationIds)).rejects.toThrow(
            'One or more IDs do not exist'
        );
    });

    it('should validate that all group IDs exist', async () => {
        const groupIds = [];
        for (let i = 0; i < 3; i++) {
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            groupIds.push(group.id.value);
        }
        await expect(idsValidator.validateGroupIds(groupIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more group IDs do not exist', async () => {
        const groupIds = [];
        for (let i = 0; i < 2; i++) {
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            groupIds.push(group.id.value);
        }

        const nonExistentGroupId = uuidv4();
        groupIds.push(nonExistentGroupId);

        await expect(idsValidator.validateGroupIds(groupIds)).rejects.toThrow('One or more IDs do not exist');
    });

    it('should validate that all oneScript IDs exist', async () => {
        const oneScriptIds = [];
        for (let i = 0; i < 3; i++) {
            const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
            oneScriptIds.push(oneScript.id.value);
        }
        await expect(idsValidator.validateOneScriptIds(oneScriptIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more oneScript IDs do not exist', async () => {
        const oneScriptIds = [];
        for (let i = 0; i < 2; i++) {
            const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
            oneScriptIds.push(oneScript.id.value);
        }

        const nonExistentOneScriptId = uuidv4();
        oneScriptIds.push(nonExistentOneScriptId);

        await expect(idsValidator.validateOneScriptIds(oneScriptIds)).rejects.toThrow('One or more IDs do not exist');
    });
});
