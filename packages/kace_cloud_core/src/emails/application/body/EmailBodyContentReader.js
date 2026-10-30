import { CustomError } from '../../../shared/index.js';

const INLINE_STORAGE_MODE = 'inline';
const EXTERNAL_STORAGE_MODE = 'external';
const PARTS = new Set(['text', 'html']);

function valueOf(valueObject, fallback = null) {
    return valueObject?.value ?? fallback;
}

function modeFor(value) {
    return value === EXTERNAL_STORAGE_MODE ? EXTERNAL_STORAGE_MODE : INLINE_STORAGE_MODE;
}

export class EmailBodyContentReader {
    #emailRepository;
    #emailBodyRepository;
    #bodyStorage;

    constructor({ emailRepository, emailBodyRepository, bodyStorage }) {
        this.#emailRepository = emailRepository;
        this.#emailBodyRepository = emailBodyRepository;
        this.#bodyStorage = bodyStorage;
    }

    async execute({ emailId, part }) {
        const normalizedPart = String(part ?? '')
            .trim()
            .toLowerCase();
        if (!PARTS.has(normalizedPart)) {
            throw new CustomError('Email body part must be text or html.', 400);
        }

        const email = await this.#emailRepository.find(emailId);
        if (!email || email.isDeleted()) {
            throw new CustomError('Email not found', 404);
        }

        const body = await this.#emailBodyRepository.find(emailId);
        if (!body) {
            throw new CustomError('Email body not found', 404);
        }

        return normalizedPart === 'html'
            ? await this.#readHtml({ emailId, body })
            : await this.#readText({ emailId, body });
    }

    async #readText({ emailId, body }) {
        const mode = modeFor(valueOf(body.body_text_storage_mode));
        if (mode === EXTERNAL_STORAGE_MODE) {
            return await this.#readExternal({
                emailId,
                part: 'text',
                mode,
                s3Key: valueOf(body.body_text_s3_key),
                fallbackContentType: valueOf(body.body_text_content_type, 'text/plain; charset=utf-8'),
            });
        }

        return {
            email_id: emailId,
            part: 'text',
            mode,
            content: valueOf(body.body, ''),
            content_type: valueOf(body.body_text_content_type, 'text/plain; charset=utf-8'),
        };
    }

    async #readHtml({ emailId, body }) {
        const mode = modeFor(valueOf(body.body_html_storage_mode));
        if (mode === EXTERNAL_STORAGE_MODE) {
            return await this.#readExternal({
                emailId,
                part: 'html',
                mode,
                s3Key: valueOf(body.body_html_s3_key),
                fallbackContentType: valueOf(body.body_html_content_type, 'text/html; charset=utf-8'),
            });
        }

        return {
            email_id: emailId,
            part: 'html',
            mode,
            content: valueOf(body.body_html, ''),
            content_type: valueOf(body.body_html_content_type, 'text/html; charset=utf-8'),
        };
    }

    async #readExternal({ emailId, part, mode, s3Key, fallbackContentType }) {
        if (!s3Key) {
            throw new CustomError('External email body storage key is missing.', 500);
        }

        if (!this.#bodyStorage || typeof this.#bodyStorage.download !== 'function') {
            throw new CustomError('Email body storage is not configured.', 500);
        }

        const stored = await this.#bodyStorage.download(s3Key);
        const content = stored?.content ?? (Buffer.isBuffer(stored?.buffer) ? stored.buffer.toString('utf8') : '');

        return {
            email_id: emailId,
            part,
            mode,
            content,
            content_type: stored?.contentType ?? fallbackContentType,
        };
    }
}
