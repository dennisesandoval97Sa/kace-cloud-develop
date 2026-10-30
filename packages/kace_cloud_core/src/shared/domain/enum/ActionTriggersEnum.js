import { Helper } from '../../infrastructure/utils/Helper';

export class ActionTriggers {
    static CREATE_CASE = new ActionTriggers('CREATE_CASE', 'crear_caso');
    static EDIT_CASE = new ActionTriggers('EDIT_CASE', 'editar_caso');
    static STATE_CHANGE = new ActionTriggers('STATE_CHANGE', 'cambio_estado');
    static CRON_JOB = new ActionTriggers('CRON_JOB', 'cron_job');
    static CREATE_USER = new ActionTriggers('CREATE_USER', 'create_user');
    static UPDATE_USER = new ActionTriggers('EDIT_USER', 'update_user');
    static DELETE_USER = new ActionTriggers('DELETE_USER', 'delete_user');
    static CREATE_GROUP = new ActionTriggers('CREATE_GROUP', 'create_group');
    static UPDATE_GROUP = new ActionTriggers('EDIT_GROUP', 'update_group');
    static DELETE_GROUP = new ActionTriggers('DELETE_GROUP', 'delete_group');

    constructor(key, value) {
        this.#ensureIsValidAction(value);
        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            crear_caso: ActionTriggers.CREATE_CASE,
            editar_caso: ActionTriggers.EDIT_CASE,
            cambio_estado: ActionTriggers.STATE_CHANGE,
            cron_job: ActionTriggers.CRON_JOB,
            create_user: ActionTriggers.CREATE_USER,
            update_user: ActionTriggers.UPDATE_USER,
            delete_user: ActionTriggers.DELETE_USER,
            create_group: ActionTriggers.CREATE_GROUP,
            update_group: ActionTriggers.UPDATE_GROUP,
            delete_group: ActionTriggers.DELETE_GROUP,
        };

        if (!map[value]) {
            Helper.logError(`Invalid status value: ${value}`);
            throw new Error(`Invalid trigger value: ${value}`);
        }
        return map[value];
    }

    #ensureIsValidAction(value) {
        const validValue = new Set(['crear_caso', 'editar_caso', 'cambio_estado', 'cron_job', 'create_user', 'update_user', 'delete_user', 'create_group', 'update_group', 'delete_group']);
        if (!validValue.has(value)) {
            throw new Error(`The value must be a valid Action value: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(ActionTriggers)) {
            if (ActionTriggers[key] instanceof ActionTriggers) {
                json[key] = ActionTriggers[key].value;
            }
        }
        return json;
    }
}
