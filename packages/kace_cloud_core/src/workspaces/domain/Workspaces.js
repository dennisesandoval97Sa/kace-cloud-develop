import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectJson,
    ValueObjectString,
    ValueObjectUuid,
} from '../../shared/index.js';
import { ValueObjectDescription } from '../domain/ValueObjectDescription.js';

export class Workspaces extends AggregateRoot {
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectString} is initialized in the constructor */
    #tag;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #rules;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #mails_accounts;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #channel_hub_accounts;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #groups;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #tag_creation_flow_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #tag_update_flow_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #tag_deletion_flow_id;

    constructor(dto) {
        super(dto.id);
        this.#description = new ValueObjectDescription('descripción', dto.description, true);
        this.#is_active = new ValueObjectBoolean('is_active', dto.is_active);
        this.#tag = new ValueObjectString('tag', dto.tag, true);
        this.#rules = new ValueObjectJson('rules', dto.rules, true);
        this.#mails_accounts = new ValueObjectJson('mails_accounts', dto.mails_accounts, true);
        this.#channel_hub_accounts = new ValueObjectJson('channel_hub_accounts', dto.channel_hub_accounts, true);
        this.#groups = new ValueObjectJson('groups', dto.groups);
        this.#tag_creation_flow_id = new ValueObjectUuid('tag_creation_flow_id', dto.tag_creation_flow_id, true);
        this.#tag_update_flow_id = new ValueObjectUuid('tag_update_flow_id', dto.tag_update_flow_id, true);
        this.#tag_deletion_flow_id = new ValueObjectUuid('tag_deletion_flow_id', dto.tag_deletion_flow_id, true);
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_by = dto.updated_by;
        this.updated_at = dto.updated_at;
        this.deleted_by = dto.deleted_by;
        this.deleted_at = dto.deleted_at;
    }

    static create(dto) {
        const work = new Workspaces(dto);
        return work;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        this.#description = new ValueObjectDescription('description', value);
        this.changedAttributes.description = this.#description.value;
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        this.#is_active = new ValueObjectBoolean('is_active', value);
        this.changedAttributes.is_active = this.#is_active.value;
    }

    get tag() {
        return this.#tag;
    }

    set tag(value) {
        this.#tag = new ValueObjectString('tag', value, true);
        this.changedAttributes.tag = this.#tag.value;
    }

    get rules() {
        return this.#rules;
    }

    set rules(value) {
        this.#rules = new ValueObjectJson('rules', value);
        this.changedAttributes.rules = this.#rules.value;
    }

    get mails_accounts() {
        return this.#mails_accounts;
    }

    set mails_accounts(value) {
        this.#mails_accounts = new ValueObjectJson('mails_accounts', value);
        this.changedAttributes.mails_accounts = this.#mails_accounts.value;
    }

    get channel_hub_accounts() {
        return this.#channel_hub_accounts;
    }

    set channel_hub_accounts(value) {
        this.#channel_hub_accounts = new ValueObjectJson('channel_hub_accounts', value, true);
        this.changedAttributes.channel_hub_accounts = this.#channel_hub_accounts.value;
    }

    get groups() {
        return this.#groups;
    }

    set groups(value) {
        this.#groups = new ValueObjectJson('groups', value);
        this.changedAttributes.groups = this.#groups.value;
    }

    get tag_creation_flow_id() {
        return this.#tag_creation_flow_id;
    }

    set tag_creation_flow_id(value) {
        this.#tag_creation_flow_id = new ValueObjectUuid('tag_creation_flow_id', value, true);
        this.changedAttributes.tag_creation_flow_id = this.#tag_creation_flow_id.value;
    }

    get tag_update_flow_id() {
        return this.#tag_update_flow_id;
    }

    set tag_update_flow_id(value) {
        this.#tag_update_flow_id = new ValueObjectUuid('tag_update_flow_id', value, true);
        this.changedAttributes.tag_update_flow_id = this.#tag_update_flow_id.value;
    }

    get tag_deletion_flow_id() {
        return this.#tag_deletion_flow_id;
    }

    set tag_deletion_flow_id(value) {
        this.#tag_deletion_flow_id = new ValueObjectUuid('tag_deletion_flow_id', value, true);
        this.changedAttributes.tag_deletion_flow_id = this.#tag_deletion_flow_id.value;
    }
}
