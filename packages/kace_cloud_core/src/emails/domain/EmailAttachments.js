import { AggregateRoot, ValueObjectInt, ValueObjectString, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { ValueObjectURL } from '../../s3-files/domain/value-objects';
import { v4 as uuidV4 } from 'uuid';

export class EmailAttachment extends AggregateRoot {
    /** @type {ValueObjectUuid} */
    #email_id;
    /** @type {ValueObjectURL} */
    #url;
    /** @type {ValueObjectInt} */
    #size;
    /** @type {ValueObjectString} */
    #filename;

    /**
     * @param {Object} params - Data Transfer Object representing an email entity.
     *
     *  @param {string} params.id
     * Unique identifier (UUID) for the email record in the database.
     *
     *  @param {string} email_id
     *  Identifier of the email email_id that received this email.
     *
     * @param {string} url
     *  Url of the email or attachment.
     *
     * @param {number} params.size
     * Size of the email or attachment, expressed as a number.
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
        email_id,
        url,
        size,
        filename = null,
        created_at,
        updated_at,
        deleted_at = null,
        created_by,
        updated_by,
        deleted_by = null,
    }) {
        super(id);

        this.#email_id = new ValueObjectUuid('email_id', email_id);
        this.#url = new ValueObjectURL(url ?? 'default');
        this.#size = new ValueObjectInt('size', size);
        this.#filename = new ValueObjectString('filename', filename, true);

        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    get email_id() {
        return this.#email_id;
    }
    set email_id(value) {
        this.#email_id = new ValueObjectUuid('email_id', value);
        this.changedAttributes.email_id = value;
    }

    get url() {
        return this.#url;
    }
    set url(value) {
        this.#url = new ValueObjectURL(value);
        this.changedAttributes.url = value;
    }

    get size() {
        return this.#size;
    }
    set size(value) {
        this.#size = new ValueObjectInt('size', value);
        this.changedAttributes.size = value;
    }

    get filename() {
        return this.#filename;
    }
    set filename(value) {
        this.#filename = new ValueObjectString('filename', value, true);
        this.changedAttributes.filename = value;
    }

    /**
     * @param {Object} params
     * @returns {EmailAttachment}
     */
    static create({
        id,
        email_id,
        url,
        size,
        filename = null,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_by,
        deleted_at,
    }) {
        return new EmailAttachment({
            id: id ?? uuidV4(),
            email_id,
            url,
            size,
            filename,
            created_at,
            updated_at,
            created_by,
            updated_by,
            deleted_by,
            deleted_at,
        });
    }
}
