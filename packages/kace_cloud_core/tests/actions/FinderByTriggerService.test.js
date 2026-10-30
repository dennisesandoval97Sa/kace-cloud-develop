import { Action, ActionTriggers, ActionTypes, KnexActionRepository } from '../../src/actions';
import { FinderByTrigger } from '../../src/actions/domain/services/FinderByTrigger';
import ActionMother from './domain/ActionMother';
import { knexConfig } from '../knexfile.js';

describe('Integration Finder Action By Trigger', () => {
    let trx;
    let actionRepository;
    let finder;

    beforeEach(async () => {
        trx = await knexConfig.transaction();
        actionRepository = new KnexActionRepository(trx);
        finder = new FinderByTrigger(actionRepository);
    });

    afterEach(async () => {
        await trx.rollback();
    });

    it('can get actions by trigger', async () => {
        const trigger = ActionTriggers.STATE_CHANGE.value;
        await ActionMother.create(actionRepository, { triggers: [trigger] });

        const actions = await finder.execute(trigger);

        expect(actions).toBeInstanceOf(Array);
        expect(actions).toHaveLength(1);
        expect(actions[0]).toBeInstanceOf(Action);
        expect(actions[0].triggers.value).toContain(trigger);
    });

    it('should only return active actions', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;
        await ActionMother.create(actionRepository, { triggers: [trigger], is_active: true });
        await ActionMother.create(actionRepository, { triggers: [trigger], is_active: false });

        const actions = await finder.execute(trigger);

        expect(actions).toHaveLength(1);
        expect(actions[0].is_active.value).toBe(true);
    });

    it('should not return soft-deleted actions', async () => {
        const trigger = ActionTriggers.STATE_CHANGE.value;
        await ActionMother.create(actionRepository, { triggers: [trigger], is_active: true });
        const softDeletedAction = await ActionMother.create(actionRepository, {
            triggers: [trigger],
            is_active: true,
        });

        softDeletedAction.delete({
            deleted_by: '00000000-0000-0000-0000-000000000000',
            deleted_at: new Date().toISOString(),
        });
        await actionRepository.delete(softDeletedAction);

        const actions = await finder.execute(trigger);

        expect(actions).toHaveLength(1);
    });

    it('should filter actions by included types', async () => {
        const trigger = ActionTriggers.EDIT_CASE.value;
        const type1 = ActionTypes.ENVIO_CORREO.value;
        const type2 = ActionTypes.CONSUMO_REST_FLOW.value;
        const otherType = ActionTypes.ACTUALIZAR_MODELO.value;

        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: type1 });
        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: type2 });
        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: otherType });

        const options = { actionTypeFilter: { include: [type1, type2] } };
        const actions = await finder.execute(trigger, options);

        expect(actions).toHaveLength(2);
        const types = actions.map((a) => a.action_type.value);
        expect(types).toContain(type1);
        expect(types).toContain(type2);
        expect(types).not.toContain(otherType);
    });

    it('should filter actions by excluded types', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;
        const excludeType = ActionTypes.ACTUALIZAR_MODELO.value;
        const allowedType = ActionTypes.ENVIO_CORREO.value;

        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: excludeType });
        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: allowedType });

        const options = { actionTypeFilter: { exclude: [excludeType] } };
        const actions = await finder.execute(trigger, options);

        expect(actions).toHaveLength(1);
        expect(actions[0].action_type.value).toBe(allowedType);
    });

    it('should query actions by GROUP_ASSIGNMENT_TYPES', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;
        const groupAssignmentTypes = [...ActionTypes.GROUP_ASSIGNMENT_TYPES];

        const matchingType = groupAssignmentTypes[0];
        const nonMatchingType = ActionTypes.ENVIO_CORREO.value;

        await ActionMother.create(actionRepository, { triggers: [trigger], action_type: matchingType });
        await ActionMother.create(actionRepository, {
            triggers: [trigger],
            action_type: nonMatchingType,
        });

        const options = { actionTypeFilter: { include: groupAssignmentTypes } };
        const actions = await finder.execute(trigger, options);

        expect(actions).toHaveLength(1);
        expect(actions[0].action_type.value).toBe(matchingType);
    });

    it('should filter actions by entity when entityFilter is provided', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;

        await ActionMother.create(actionRepository, { triggers: [trigger], entity: 'case' });
        await ActionMother.create(actionRepository, { triggers: [trigger], entity: 'user' });
        await ActionMother.create(actionRepository, { triggers: [trigger], entity: 'group' });

        const onlyUsers = await finder.execute(trigger, { entityFilter: 'user' });

        expect(onlyUsers).toHaveLength(1);
        expect(onlyUsers[0].entity.value).toBe('user');
    });

    it('should not filter by entity when entityFilter is omitted', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;

        await ActionMother.create(actionRepository, { triggers: [trigger], entity: 'case' });
        await ActionMother.create(actionRepository, { triggers: [trigger], entity: 'user' });

        const all = await finder.execute(trigger);

        expect(all).toHaveLength(2);
    });

    it('should combine entityFilter with actionTypeFilter.exclude', async () => {
        const trigger = ActionTriggers.CRON_JOB.value;
        const allowedType = ActionTypes.ENVIO_CORREO.value;
        const excludedType = ActionTypes.ACTUALIZAR_MODELO.value;

        await ActionMother.create(actionRepository, {
            triggers: [trigger],
            entity: 'case',
            action_type: allowedType,
        });
        await ActionMother.create(actionRepository, {
            triggers: [trigger],
            entity: 'case',
            action_type: excludedType,
        });
        await ActionMother.create(actionRepository, {
            triggers: [trigger],
            entity: 'user',
            action_type: allowedType,
        });

        const result = await finder.execute(trigger, {
            entityFilter: 'case',
            actionTypeFilter: { exclude: [excludedType] },
        });

        expect(result).toHaveLength(1);
        expect(result[0].entity.value).toBe('case');
        expect(result[0].action_type.value).toBe(allowedType);
    });
});
