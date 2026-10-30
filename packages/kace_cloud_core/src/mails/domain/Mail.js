import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectInt } from '../../shared/domain/value-object/ValueObjectInt.js';
import { ValueObjectEmailArray } from '../../shared/domain/value-object/ValueObjectEmailArray.js';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { ValueObjectTimestamp } from '../../shared/domain/value-object/ValueObjectTimestamp.js';
import { HtmlTemplateSanitizer } from '../../shared/domain/security/HtmlTemplateSanitizer.js';

export class Mail extends AggregateRoot {
    /** @type {ValueObjectEmailArray} is initialized in the constructor */
    #to;
    /** @type {ValueObjectEmailArray} is initialized in the constructor */
    #cc;
    /** @type {ValueObjectEmailArray} is initialized in the constructor */
    #bcc;
    /** @type {ValueObjectString} is initialized in the constructor */
    #subject;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #priority;
    /** @type {ValueObjectString} is initialized in the constructor */
    #mail_account_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #sent_status;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #sent_at;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #sent_by;
    /** @type {ValueObjectString} is initialized in the constructor */
    #type;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #reply_mail_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #content;
    /** @type {{ value: Array<{ filename: string, contentType?: string, content: Buffer }> }} */
    #attachments;

    constructor(dto) {
        super(dto.id);
        this.#mail_account_id = new ValueObjectString('mail_account_id', dto.mail_account_id);
        this.#to = new ValueObjectEmailArray('to', dto.to ?? ['default@default.com']);
        this.#cc = new ValueObjectEmailArray('cc', dto.cc, true);
        this.#bcc = new ValueObjectEmailArray('bcc', dto.bcc, true);
        this.#subject = new ValueObjectString('subject', dto.subject ?? 'default');
        /*
         * content is rendered HTML coming from a Template body that has already gone through
         * HtmlTemplateSanitizer (see ValueObjectBody) - render it again here because
         * replaceTemplateVariables() can reintroduce literal "&lt;"/"&gt;" text (e.g. a user
         * typing `<h1>` as plain text in the editor gets HTML-escaped on save), and those
         * substrings are bare words in XSSGuard's blocklist ("&lt", "&gt", ...). Skip both
         * keyword-blocklist guards for the same reason ValueObjectBody does: structural
         * sanitization is strictly more correct for HTML email bodies than a substring
         * blocklist, which was silently blocking legitimate sends (mail marked as failed with
         * no visible error) instead of protecting anything.
         */
        const sanitizedContent =
            typeof dto.content === 'string' ? HtmlTemplateSanitizer.sanitize(dto.content) : dto.content;
        this.#content = new ValueObjectString('content', sanitizedContent ?? 'default', false, 100000, true, true);
        this.#priority = new ValueObjectInt('priority', dto.priority, true);
        this.#sent_by = new ValueObjectUuid('sent_by', dto.sent_by, true);
        this.#type = new ValueObjectString('type', dto.type, true);
        this.#reply_mail_id = new ValueObjectUuid('reply_mail_id', dto.reply_mail_id, true);
        this.#sent_at = new ValueObjectTimestamp('sent_at', dto.sent_at, true);
        this.#sent_status = new ValueObjectString('sent_status', dto.sent_status ?? 'default');
        this.#attachments = { value: Array.isArray(dto.attachments) ? dto.attachments : [] };

        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get to() {
        return this.#to;
    }

    get cc() {
        return this.#cc;
    }

    get bcc() {
        return this.#bcc;
    }

    get subject() {
        return this.#subject;
    }

    get priority() {
        return this.#priority;
    }

    get mail_account_id() {
        return this.#mail_account_id;
    }

    get sent_status() {
        return this.#sent_status;
    }

    set sent_status(value) {
        if (this.#sent_status.value !== value) {
            this.#sent_status = new ValueObjectString('sent_status', value);
            this.changedAttributes.sent_status = value;
        }
    }

    get sent_at() {
        return this.#sent_at;
    }

    set sent_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#sent_at.value !== value) {
            this.#sent_at = new ValueObjectTimestamp('sent_at', value);
            this.changedAttributes.sent_at = value;
        }
    }

    get sent_by() {
        return this.#sent_by;
    }

    get type() {
        return this.#type;
    }

    get reply_mail_id() {
        return this.#reply_mail_id;
    }

    get content() {
        return this.#content;
    }

    get attachments() {
        return this.#attachments;
    }

    static create(dto) {
        return new Mail(dto);
    }
}
