import { AggregateRoot, ValueObject, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { ValueObjectEmailBody } from './value-object/ValueObjectEmailBody';

export class EmailBody extends AggregateRoot {
    #email_id;
    #body;
    #body_html;
    #body_text_storage_mode;
    #body_text_s3_key;
    #body_text_size_bytes;
    #body_text_content_type;
    #body_text_sha256;
    #body_text_preview_truncated;
    #body_html_storage_mode;
    #body_html_s3_key;
    #body_html_size_bytes;
    #body_html_content_type;
    #body_html_sha256;
    #body_html_preview_truncated;

    constructor({
        id,
        email_id,
        body,
        body_html = null,
        body_text_storage_mode = null,
        body_text_s3_key = null,
        body_text_size_bytes = null,
        body_text_content_type = null,
        body_text_sha256 = null,
        body_text_preview_truncated = false,
        body_html_storage_mode = null,
        body_html_s3_key = null,
        body_html_size_bytes = null,
        body_html_content_type = null,
        body_html_sha256 = null,
        body_html_preview_truncated = false,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at = null,
        deleted_by = null,
    }) {
        super(id);
        this.#email_id = new ValueObjectUuid('email_id', email_id);
        this.#body = new ValueObjectEmailBody('body', body);
        this.#body_html = new ValueObjectEmailBody('body_html', body_html, true);
        this.#body_text_storage_mode = new ValueObject('body_text_storage_mode', body_text_storage_mode);
        this.#body_text_s3_key = new ValueObject('body_text_s3_key', body_text_s3_key);
        this.#body_text_size_bytes = new ValueObject(
            'body_text_size_bytes',
            this.#nullableNumber(body_text_size_bytes)
        );
        this.#body_text_content_type = new ValueObject('body_text_content_type', body_text_content_type);
        this.#body_text_sha256 = new ValueObject('body_text_sha256', body_text_sha256);
        this.#body_text_preview_truncated = new ValueObject(
            'body_text_preview_truncated',
            this.#booleanValue(body_text_preview_truncated)
        );
        this.#body_html_storage_mode = new ValueObject('body_html_storage_mode', body_html_storage_mode);
        this.#body_html_s3_key = new ValueObject('body_html_s3_key', body_html_s3_key);
        this.#body_html_size_bytes = new ValueObject(
            'body_html_size_bytes',
            this.#nullableNumber(body_html_size_bytes)
        );
        this.#body_html_content_type = new ValueObject('body_html_content_type', body_html_content_type);
        this.#body_html_sha256 = new ValueObject('body_html_sha256', body_html_sha256);
        this.#body_html_preview_truncated = new ValueObject(
            'body_html_preview_truncated',
            this.#booleanValue(body_html_preview_truncated)
        );
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

    get body() {
        return this.#body;
    }
    set body(value) {
        this.#body = new ValueObjectEmailBody('body', value);
        this.changedAttributes.body = value;
    }

    get body_html() {
        return this.#body_html;
    }
    set body_html(value) {
        this.#body_html = new ValueObjectEmailBody('body_html', value, true);
        this.changedAttributes.body_html = value;
    }

    get body_text_storage_mode() {
        return this.#body_text_storage_mode;
    }
    set body_text_storage_mode(value) {
        this.#body_text_storage_mode = new ValueObject('body_text_storage_mode', value);
        this.changedAttributes.body_text_storage_mode = value;
    }

    get body_text_s3_key() {
        return this.#body_text_s3_key;
    }
    set body_text_s3_key(value) {
        this.#body_text_s3_key = new ValueObject('body_text_s3_key', value);
        this.changedAttributes.body_text_s3_key = value;
    }

    get body_text_size_bytes() {
        return this.#body_text_size_bytes;
    }
    set body_text_size_bytes(value) {
        this.#body_text_size_bytes = new ValueObject('body_text_size_bytes', this.#nullableNumber(value));
        this.changedAttributes.body_text_size_bytes = this.#body_text_size_bytes.value;
    }

    get body_text_content_type() {
        return this.#body_text_content_type;
    }
    set body_text_content_type(value) {
        this.#body_text_content_type = new ValueObject('body_text_content_type', value);
        this.changedAttributes.body_text_content_type = value;
    }

    get body_text_sha256() {
        return this.#body_text_sha256;
    }
    set body_text_sha256(value) {
        this.#body_text_sha256 = new ValueObject('body_text_sha256', value);
        this.changedAttributes.body_text_sha256 = value;
    }

    get body_text_preview_truncated() {
        return this.#body_text_preview_truncated;
    }
    set body_text_preview_truncated(value) {
        this.#body_text_preview_truncated = new ValueObject('body_text_preview_truncated', this.#booleanValue(value));
        this.changedAttributes.body_text_preview_truncated = this.#body_text_preview_truncated.value;
    }

    get body_html_storage_mode() {
        return this.#body_html_storage_mode;
    }
    set body_html_storage_mode(value) {
        this.#body_html_storage_mode = new ValueObject('body_html_storage_mode', value);
        this.changedAttributes.body_html_storage_mode = value;
    }

    get body_html_s3_key() {
        return this.#body_html_s3_key;
    }
    set body_html_s3_key(value) {
        this.#body_html_s3_key = new ValueObject('body_html_s3_key', value);
        this.changedAttributes.body_html_s3_key = value;
    }

    get body_html_size_bytes() {
        return this.#body_html_size_bytes;
    }
    set body_html_size_bytes(value) {
        this.#body_html_size_bytes = new ValueObject('body_html_size_bytes', this.#nullableNumber(value));
        this.changedAttributes.body_html_size_bytes = this.#body_html_size_bytes.value;
    }

    get body_html_content_type() {
        return this.#body_html_content_type;
    }
    set body_html_content_type(value) {
        this.#body_html_content_type = new ValueObject('body_html_content_type', value);
        this.changedAttributes.body_html_content_type = value;
    }

    get body_html_sha256() {
        return this.#body_html_sha256;
    }
    set body_html_sha256(value) {
        this.#body_html_sha256 = new ValueObject('body_html_sha256', value);
        this.changedAttributes.body_html_sha256 = value;
    }

    get body_html_preview_truncated() {
        return this.#body_html_preview_truncated;
    }
    set body_html_preview_truncated(value) {
        this.#body_html_preview_truncated = new ValueObject('body_html_preview_truncated', this.#booleanValue(value));
        this.changedAttributes.body_html_preview_truncated = this.#body_html_preview_truncated.value;
    }

    #nullableNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    #booleanValue(value) {
        if (value === true || value === 1 || value === '1') {
            return true;
        }

        if (value === false || value === 0 || value === '0' || value === null || value === undefined) {
            return false;
        }

        return Boolean(value);
    }

    static create({
        id,
        email_id,
        body,
        body_html = null,
        body_text_storage_mode = null,
        body_text_s3_key = null,
        body_text_size_bytes = null,
        body_text_content_type = null,
        body_text_sha256 = null,
        body_text_preview_truncated = false,
        body_html_storage_mode = null,
        body_html_s3_key = null,
        body_html_size_bytes = null,
        body_html_content_type = null,
        body_html_sha256 = null,
        body_html_preview_truncated = false,
        created_at,
        updated_at,
        deleted_at,
        created_by,
        updated_by,
        deleted_by,
    }) {
        return new EmailBody({
            id: id ?? ValueObjectUuid.random(),
            email_id,
            body,
            body_html,
            body_text_storage_mode,
            body_text_s3_key,
            body_text_size_bytes,
            body_text_content_type,
            body_text_sha256,
            body_text_preview_truncated,
            body_html_storage_mode,
            body_html_s3_key,
            body_html_size_bytes,
            body_html_content_type,
            body_html_sha256,
            body_html_preview_truncated,
            created_at,
            updated_at,
            deleted_at,
            created_by,
            updated_by,
            deleted_by,
        });
    }
}
