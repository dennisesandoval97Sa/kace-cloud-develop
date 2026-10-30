import {
    ValueObjectBoolean,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectString,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '@kace/core/src/shared/index.js';
import { ValueObjectURL } from '../../s3-files/domain/value-objects';
import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';

export class Email extends AggregateRoot {
    /** @type {ValueObjectURL} */
    #s3_key;
    /** @type {ValueObjectString} */
    #subject;
    /** @type {ValueObjectString} */
    #sender;
    /** @type {ValueObjectJson} */
    #to;
    /** @type {ValueObjectJson} */
    #cc;
    /** @type {ValueObjectJson} */
    #bcc;
    /** @type {ValueObjectString} */
    #priority;
    /** @type {ValueObjectString} */
    #workspace_id;
    /** @type {ValueObjectString} */
    #message_id;
    /** @type {ValueObjectString} */
    #thread_id;
    /** @type {ValueObjectString} */
    #account_id;
    /** @type {ValueObjectTimestamp} */
    #received_at;
    /** @type {ValueObjectUuid} */
    #case_id_outbound;
    /** @type {ValueObjectInt} */
    #case_reference_outbound;
    /** @type {ValueObjectBoolean} */
    #is_outbound;

    /**
     * @param {Object} params - Data Transfer Object representing an email entity.
     *
     * @param {string} params.id
     * Unique identifier (UUID) for the email record in the database.
     *
     * @param {string} params.s3_key
     * Full S3 object path where the raw email.
     *
     * @param {string} params.subject
     * Subject of the email as received from the mail provider.
     *
     * @param {string} params.sender
     * Email address of the sender (FROM field).
     *
     * @param {Object[]} params.to
     * List of primary recipients (TO field) including name and email address.
     *
     * @param {Object[]} params.cc
     * List of carbon copy recipients (CC field) including name and email address.
     *
     * @param {Object[]} params.bcc
     * List of blind carbon copy recipients (BCC field) including name and email address.
     *
     * @param {string} params.priority
     * Email priority level (e.g., "high", "normal", "low") or system-defined priority.
     *
     * @param {string} params.workspace_id
     * Identifier of the workspace or tenant to which this email belongs.
     *
     * @param {string} params.message_id
     * Unique Message-ID extracted from the MIME headers; used to avoid duplicates.
     *
     * @param {string|null} params.thread_id
     * Thread identifier from the mail provider; used to relate messages that belong to the same external thread.
     *
     * @param {string} params.account_id
     * Identifier of the email account that received this email.
     *
     * @param {string} params.received_at
     * Timestamp indicating when the email was received by the system.
     *
     * @param {string} params.created_at
     * Timestamp indicating when the email record was created in the database.
     *
     * @param {string} params.updated_at
     * Timestamp of the last modification to the email record.
     *
     * @param {string} params.deleted_at
     * Timestamp indicating when the email record was soft-deleted (if applicable).
     *
     * @param {string} params.created_by
     * UUID of the user or process that created the email record.
     *
     * @param {string} params.updated_by
     * UUID of the user or process that last updated the email record.
     *
     * @param {string} params.deleted_by
     * UUID of the user or process that soft-deleted the email record.
     */
    constructor({
        id,
        s3_key,
        subject,
        sender,
        to,
        cc,
        bcc,
        priority,
        workspace_id,
        message_id,
        thread_id = null,
        account_id,
        received_at,
        case_id_outbound = null,
        case_reference_outbound = null,
        is_outbound = false,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at = null,
        deleted_by = null,
    }) {
        super(id);
        this.#s3_key = new ValueObjectURL(s3_key ?? 'default');
        this.#subject = new ValueObjectString('subject', subject);
        this.#sender = new ValueObjectString('sender', sender);
        this.#to = new ValueObjectJson('to', to ?? []);
        this.#cc = new ValueObjectJson('cc', cc ?? []);
        this.#bcc = new ValueObjectJson('bcc', bcc ?? []);
        this.#priority = new ValueObjectString('priority', priority);
        this.#workspace_id = new ValueObjectUuid('workspace_id', workspace_id);
        this.#message_id = new ValueObjectString('message_id', message_id);
        this.#thread_id = new ValueObjectString('thread_id', thread_id, true);
        this.#account_id = new ValueObjectUuid('account_id', account_id);
        this.#received_at = new ValueObjectTimestamp('received_at', received_at);
        this.#case_id_outbound = new ValueObjectUuid('case_id_outbound', case_id_outbound, true);
        this.#case_reference_outbound = new ValueObjectInt('case_reference_outbound', case_reference_outbound, true);
        this.#is_outbound = new ValueObjectBoolean('is_outbound', is_outbound ?? false);
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    get s3_key() {
        return this.#s3_key;
    }
    set s3_key(value) {
        this.#s3_key = new ValueObjectURL(value);
        this.changedAttributes.s3_key = value;
    }

    get subject() {
        return this.#subject;
    }
    set subject(value) {
        this.#subject = new ValueObjectString('subject', value);
        this.changedAttributes.subject = value;
    }

    get sender() {
        return this.#sender;
    }
    set sender(value) {
        this.#sender = new ValueObjectString('sender', value);
        this.changedAttributes.sender = value;
    }

    get to() {
        return this.#to;
    }
    set to(value) {
        this.#to = new ValueObjectJson('to', value);
        this.changedAttributes.to = value;
    }

    get cc() {
        return this.#cc;
    }
    set cc(value) {
        this.#cc = new ValueObjectJson('cc', value);
        this.changedAttributes.cc = value;
    }

    get bcc() {
        return this.#bcc;
    }
    set bcc(value) {
        this.#bcc = new ValueObjectJson('bcc', value);
        this.changedAttributes.bcc = value;
    }

    get priority() {
        return this.#priority;
    }
    set priority(value) {
        this.#priority = new ValueObjectString('priority', value);
        this.changedAttributes.priority = value;
    }

    get workspace_id() {
        return this.#workspace_id;
    }
    set workspace_id(value) {
        this.#workspace_id = new ValueObjectUuid('workspace_id', value);
        this.changedAttributes.workspace_id = value;
    }

    get message_id() {
        return this.#message_id;
    }
    set message_id(value) {
        this.#message_id = new ValueObjectString('message_id', value);
        this.changedAttributes.message_id = value;
    }

    get thread_id() {
        return this.#thread_id;
    }
    set thread_id(value) {
        this.#thread_id = new ValueObjectString('thread_id', value, true);
        this.changedAttributes.thread_id = value;
    }

    get account_id() {
        return this.#account_id;
    }
    set account_id(value) {
        this.#account_id = new ValueObjectUuid('account_id', value);
        this.changedAttributes.account_id = value;
    }

    get received_at() {
        return this.#received_at;
    }
    set received_at(value) {
        this.#received_at = new ValueObjectTimestamp('received_at', value);
        this.changedAttributes.received_at = value;
    }

    get case_id_outbound() {
        return this.#case_id_outbound;
    }
    set case_id_outbound(value) {
        this.#case_id_outbound = new ValueObjectUuid('case_id_outbound', value, true);
        this.changedAttributes.case_id_outbound = value;
    }

    get case_reference_outbound() {
        return this.#case_reference_outbound;
    }
    set case_reference_outbound(value) {
        this.#case_reference_outbound = new ValueObjectInt('case_reference_outbound', value, true);
        this.changedAttributes.case_reference_outbound = value;
    }

    get is_outbound() {
        return this.#is_outbound;
    }
    set is_outbound(value) {
        this.#is_outbound = new ValueObjectBoolean('is_outbound', value ?? false);
        this.changedAttributes.is_outbound = value;
    }

    /**
     * @param {Object} params
     * @returns {Email}
     */
    static create(params) {
        return new Email(params);
    }
}
