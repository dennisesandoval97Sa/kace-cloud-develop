import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectString,
    ValueObjectJson,
    ValueObjectUuid,
} from '../../shared/index.js';

export class ChannelHubAccount extends AggregateRoot {
    /** @type {ValueObjectString} */
    #email;
    /** @type {ValueObjectString} */
    #name;
    /** @type {ValueObjectString} */
    #country_id;
    /** @type {ValueObjectString} */
    #operator_id;
    /** @type {ValueObjectUuid} */
    #rest_flow_id;
    /** @type {ValueObjectUuid} */
    #mail_rule_list_rest_flow_id;
    /** @type {ValueObjectUuid} */
    #mail_rule_priority_update_rest_flow_id;
    /** @type {ValueObjectString} */
    #channel_hub_connection_id;
    /** @type {ValueObjectBoolean} */
    #is_active;
    /** @type {ValueObjectJson} */
    #channel_hub_error;

    constructor(data) {
        super(data.id);
        this.#email = new ValueObjectString('email', data.email);
        this.#name = new ValueObjectString('name', data.name);
        this.#country_id = new ValueObjectString('country_id', data.country_id);
        this.#operator_id = new ValueObjectString('operator_id', data.operator_id ?? 'imap');
        this.#rest_flow_id = new ValueObjectUuid('rest_flow_id', data.rest_flow_id);
        this.#mail_rule_list_rest_flow_id = new ValueObjectUuid(
            'mail_rule_list_rest_flow_id',
            data.mail_rule_list_rest_flow_id,
            true
        );
        this.#mail_rule_priority_update_rest_flow_id = new ValueObjectUuid(
            'mail_rule_priority_update_rest_flow_id',
            data.mail_rule_priority_update_rest_flow_id,
            true
        );
        this.#channel_hub_connection_id = new ValueObjectString(
            'channel_hub_connection_id',
            data.channel_hub_connection_id,
            true
        );
        this.#is_active = new ValueObjectBoolean('is_active', data.is_active ?? true);
        this.#channel_hub_error = new ValueObjectJson('channel_hub_error', data.channel_hub_error, true);

        // Delegate audit fields to AggregateRoot via setters
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.deleted_at = data.deleted_at;
        this.created_by = data.created_by;
        this.updated_by = data.updated_by;
        this.deleted_by = data.deleted_by;
    }

    static create(dto) {
        return new ChannelHubAccount(dto);
    }

    get email() {
        return this.#email;
    }
    get name() {
        return this.#name;
    }
    set name(value) {
        if (this.#name.value !== value) {
            this.#name = new ValueObjectString('name', value);
            this.changedAttributes.name = value;
        }
    }
    get country_id() {
        return this.#country_id;
    }
    set country_id(value) {
        if (this.#country_id.value !== value) {
            this.#country_id = new ValueObjectString('country_id', value);
            this.changedAttributes.country_id = value;
        }
    }
    get operator_id() {
        return this.#operator_id;
    }
    set operator_id(value) {
        if (this.#operator_id.value !== value) {
            this.#operator_id = new ValueObjectString('operator_id', value);
            this.changedAttributes.operator_id = value;
        }
    }
    get rest_flow_id() {
        return this.#rest_flow_id;
    }
    set rest_flow_id(value) {
        if (this.#rest_flow_id.value !== value) {
            this.#rest_flow_id = new ValueObjectUuid('rest_flow_id', value);
            this.changedAttributes.rest_flow_id = value;
        }
    }
    get mail_rule_list_rest_flow_id() {
        return this.#mail_rule_list_rest_flow_id;
    }
    set mail_rule_list_rest_flow_id(value) {
        if (this.#mail_rule_list_rest_flow_id.value !== value) {
            this.#mail_rule_list_rest_flow_id = new ValueObjectUuid('mail_rule_list_rest_flow_id', value, true);
            this.changedAttributes.mail_rule_list_rest_flow_id = value;
        }
    }
    get mail_rule_priority_update_rest_flow_id() {
        return this.#mail_rule_priority_update_rest_flow_id;
    }
    set mail_rule_priority_update_rest_flow_id(value) {
        if (this.#mail_rule_priority_update_rest_flow_id.value !== value) {
            this.#mail_rule_priority_update_rest_flow_id = new ValueObjectUuid(
                'mail_rule_priority_update_rest_flow_id',
                value,
                true
            );
            this.changedAttributes.mail_rule_priority_update_rest_flow_id = value;
        }
    }
    get channel_hub_connection_id() {
        return this.#channel_hub_connection_id;
    }
    get is_active() {
        return this.#is_active;
    }
    get channel_hub_error() {
        return this.#channel_hub_error;
    }

    // update() and delete() are inherited from AggregateRoot — do NOT override them.

    toJson() {
        return {
            id: this.id.value,
            email: this.#email.value,
            name: this.#name.value,
            country_id: this.#country_id.value,
            operator_id: this.#operator_id.value,
            rest_flow_id: this.#rest_flow_id.value,
            mail_rule_list_rest_flow_id: this.#mail_rule_list_rest_flow_id.value,
            mail_rule_priority_update_rest_flow_id: this.#mail_rule_priority_update_rest_flow_id.value,
            channel_hub_connection_id: this.#channel_hub_connection_id.value,
            is_active: this.#is_active.value,
            created_at: this.created_at?.value,
            created_by: this.created_by?.value,
            updated_at: this.updated_at?.value,
            updated_by: this.updated_by?.value,
            deleted_at: this.deleted_at?.value,
            deleted_by: this.deleted_by?.value,
            channel_hub_error: this.#channel_hub_error.value,
        };
    }
}
