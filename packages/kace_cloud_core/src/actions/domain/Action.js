import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectDescription,
    ValueObjectJson,
    ValueObjectString,
    ValueObjectUuid,
} from '../../shared';
import { ValueObjectPriority } from './value-objects/ValueObjectPriority';
import { ValueObjectActionType } from './value-objects/ValueObjectActionType';
import { ActionTypeValidator } from './validators/ActionTypeValidator';
import { ValueObjectTriggers } from './value-objects/ValueObjectTriggers';
import { ValueObjectPermissions } from './value-objects/ValueObjectPermissions';
import { ValueObjectExternalCode } from './value-objects/ValueObjectExternalCode';
import { ValueObjectEntity } from './value-objects/ValueObjectEntity';

export class Action extends AggregateRoot {
    /** @type {ValueObjectActionType} is initialized in the constructor */
    #action_type;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #conditions;
    /** @type {ValueObjectTriggers} is initialized in the constructor */
    #triggers;
    /** @type {ValueObjectPermissions} is initialized in the constructor */
    #permissions;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #state_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #group_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #responsible_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #template_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #mail_account_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #advisor_list_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #group_list_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #ws_rest_flow_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #model_update_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #external_group_code;
    /** @type {ValueObjectExternalCode} is initialized in the constructor */
    #external_user_code;
    /** @type {ValueObjectExternalCode} is initialized in the constructor */
    #external_group_dynamic_code;
    /** @type {ValueObjectExternalCode} is initialized in the constructor */
    #external_user_dynamic_code;
    /** @type {ValueObjectExternalCode} is initialized in the constructor */
    #priority;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #automation_id;
    /** @type {ValueObjectEntity} is initialized in the constructor */
    #entity;

    constructor({
        id,
        action_type,
        description,
        conditions,
        triggers,
        permissions,
        state_id,
        group_id,
        responsible_id,
        template_id,
        mail_account_id,
        advisor_list_id,
        group_list_id,
        ws_rest_flow_id,
        model_update_id,
        external_group_code,
        external_user_code,
        external_group_dynamic_code,
        external_user_dynamic_code,
        priority,
        is_active,
        automation_id,
        entity,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#action_type = new ValueObjectActionType('action_type', action_type);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        this.#conditions = new ValueObjectJson('conditions', conditions ?? {}); // TODO: Validar estructura de las condiciones
        this.#triggers = new ValueObjectTriggers('triggers', triggers, true);
        this.#permissions = new ValueObjectPermissions('permissions', permissions, true);
        this.#state_id = new ValueObjectUuid('state_id', state_id, true);
        this.#group_id = new ValueObjectUuid('group_id', group_id, true);
        this.#responsible_id = new ValueObjectUuid('responsible_id', responsible_id, true);
        this.#template_id = new ValueObjectUuid('template_id', template_id, true);
        this.#mail_account_id = new ValueObjectUuid('mail_account_id', mail_account_id, true);
        this.#advisor_list_id = new ValueObjectUuid('advisor_list_id', advisor_list_id, true);
        this.#group_list_id = new ValueObjectUuid('group_list_id', group_list_id, true);
        this.#ws_rest_flow_id = new ValueObjectUuid('ws_rest_flow_id', ws_rest_flow_id, true);
        this.#model_update_id = new ValueObjectUuid('model_update_id', model_update_id, true);
        this.#external_group_code = new ValueObjectExternalCode('external_group_code', external_group_code, true);
        this.#external_user_code = new ValueObjectExternalCode('external_user_code', external_user_code, true);
        this.#external_group_dynamic_code = new ValueObjectExternalCode(
            'external_group_dynamic_code',
            external_group_dynamic_code,
            true
        );
        this.#external_user_dynamic_code = new ValueObjectExternalCode(
            'external_user_dynamic_code',
            external_user_dynamic_code,
            true
        );
        this.#priority = new ValueObjectPriority('priority', priority ?? 1);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#automation_id = new ValueObjectUuid('automation_id', automation_id, true);
        this.#entity = new ValueObjectEntity('entity', entity, true);

        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get action_type() {
        return this.#action_type;
    }

    set action_type(value) {
        if (this.#action_type.value !== value) {
            this.#action_type = new ValueObjectActionType('action_type', value);
            this.changedAttributes.action_type = value;
        }
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    get conditions() {
        return this.#conditions;
    }

    set conditions(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#conditions.value !== value) {
            this.#conditions = new ValueObjectJson('conditions', value);
            this.changedAttributes.conditions = value;
        }
    }

    get triggers() {
        return this.#triggers;
    }

    set triggers(value) {
        if (this.#triggers.value !== value) {
            this.#triggers = new ValueObjectTriggers('triggers', value);
            this.changedAttributes.triggers = JSON.stringify(value);
        }
    }

    get permissions() {
        return this.#permissions;
    }

    set permissions(value) {
        if (this.#permissions.value !== value) {
            this.#permissions = new ValueObjectPermissions('permissions', value, true);
            this.changedAttributes.permissions = value;
        }
    }

    get state_id() {
        return this.#state_id;
    }

    set state_id(value) {
        if (this.#state_id.value !== value) {
            this.#state_id = new ValueObjectUuid('state_id', value);
            this.changedAttributes.state_id = value;
        }
    }

    get group_id() {
        return this.#group_id;
    }

    set group_id(value) {
        if (this.#group_id.value !== value) {
            this.#group_id = new ValueObjectUuid('group_id', value);
            this.changedAttributes.group_id = value;
        }
    }

    get responsible_id() {
        return this.#responsible_id;
    }

    set responsible_id(value) {
        if (this.#responsible_id.value !== value) {
            this.#responsible_id = new ValueObjectUuid('responsible_id', value);
            this.changedAttributes.responsible_id = value;
        }
    }

    get template_id() {
        return this.#template_id;
    }

    set template_id(value) {
        if (this.#template_id.value !== value) {
            this.#template_id = new ValueObjectUuid('template_id', value);
            this.changedAttributes.template_id = value;
        }
    }

    get mail_account_id() {
        return this.#mail_account_id;
    }

    set mail_account_id(value) {
        if (this.#mail_account_id.value !== value) {
            this.#mail_account_id = new ValueObjectUuid('mail_account_id', value);
            this.changedAttributes.mail_account_id = value;
        }
    }

    get advisor_list_id() {
        return this.#advisor_list_id;
    }

    set advisor_list_id(value) {
        if (this.#advisor_list_id.value !== value) {
            this.#advisor_list_id = new ValueObjectUuid('advisor_list_id', value);
            this.changedAttributes.advisor_list_id = value;
        }
    }

    get group_list_id() {
        return this.#group_list_id;
    }

    set group_list_id(value) {
        if (this.#group_list_id.value !== value) {
            this.#group_list_id = new ValueObjectUuid('group_list_id', value);
            this.changedAttributes.group_list_id = value;
        }
    }

    get ws_rest_flow_id() {
        return this.#ws_rest_flow_id;
    }

    set ws_rest_flow_id(value) {
        if (this.#ws_rest_flow_id.value !== value) {
            this.#ws_rest_flow_id = new ValueObjectUuid('ws_rest_flow_id', value);
            this.changedAttributes.ws_rest_flow_id = value;
        }
    }

    get model_update_id() {
        return this.#model_update_id;
    }

    set model_update_id(value) {
        if (this.#model_update_id.value !== value) {
            this.#model_update_id = new ValueObjectUuid('model_update_id', value);
            this.changedAttributes.model_update_id = value;
        }
    }

    get external_group_code() {
        return this.#external_group_code;
    }

    set external_group_code(value) {
        if (this.#external_group_code.value !== value) {
            this.#external_group_code = new ValueObjectExternalCode('external_group_code', value);
            this.changedAttributes.external_group_code = value;
        }
    }

    get external_user_code() {
        return this.#external_user_code;
    }

    set external_user_code(value) {
        if (this.#external_user_code.value !== value) {
            this.#external_user_code = new ValueObjectExternalCode('external_user_code', value);
            this.changedAttributes.external_user_code = value;
        }
    }

    get external_group_dynamic_code() {
        return this.#external_group_dynamic_code;
    }

    set external_group_dynamic_code(value) {
        if (this.#external_group_dynamic_code.value !== value) {
            this.#external_group_dynamic_code = new ValueObjectExternalCode('external_group_dynamic_code', value);
            this.changedAttributes.external_group_dynamic_code = value;
        }
    }

    get external_user_dynamic_code() {
        return this.#external_user_dynamic_code;
    }

    set external_user_dynamic_code(value) {
        if (this.#external_user_dynamic_code.value !== value) {
            this.#external_user_dynamic_code = new ValueObjectExternalCode('external_user_dynamic_code', value);
            this.changedAttributes.external_user_dynamic_code = value;
        }
    }

    get priority() {
        return this.#priority;
    }

    set priority(value) {
        if (this.#priority.value !== value) {
            this.#priority = new ValueObjectPriority('priority', value);
            this.changedAttributes.priority = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    get automation_id() {
        return this.#automation_id;
    }
    set automation_id(value) {
        if (this.#automation_id.value !== value) {
            this.#automation_id = new ValueObjectUuid('automation_id', value, true);
            this.changedAttributes.automation_id = value;
        }
    }

    get entity() {
        return this.#entity;
    }

    set entity(value) {
        if (this.#entity.value !== value) {
            this.#entity = new ValueObjectEntity('entity', value, true);
            this.changedAttributes.entity = value;
        }
    }

    /**
     * Creates a new instance of Action from a DTO object.
     *
     * @param {Object} dto - The DTO object that contains the properties for the Action object.
     * @returns {Action} A new instance of the Action class.
     */
    static create(dto) {
        return new Action(dto);
    }

    validate() {
        ActionTypeValidator.validate(this);
        return true;
    }

    /**
     * Checks if a user has access permissions based on white and black lists.
     *
     * - If the user is in the **WhiteList** of users, access is granted.
     * - If the user is in the **BlackList** of users or groups, access is denied.
     * - If the user is in neither list, access is granted by default.
     *
     * @param {User} user - The user to check.
     * @returns {boolean} `true` if the user has access, `false` if not.
     */
    hasPermission(user) {
        if (!this.permissions.value) return true;

        const { whiteList, blackList } = this.permissions.value;

        const isUserInList = (searchId, list) => list.some((item) => item === searchId.value);

        if (whiteList?.usuarios && isUserInList(user.id, whiteList.usuarios)) {
            return true;
        }

        if (blackList) {
            if (blackList?.grupos && isUserInList(user.grupo_activo, blackList.grupos)) {
                return false;
            }

            if (blackList?.usuarios && isUserInList(user.id, blackList.usuarios)) {
                return false;
            }
        }

        return true;
    }
}
