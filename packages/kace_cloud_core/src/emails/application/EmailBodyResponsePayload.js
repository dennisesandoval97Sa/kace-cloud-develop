const INLINE_STORAGE_MODE = 'inline';
const EXTERNAL_STORAGE_MODE = 'external';

function valueOf(valueObject, fallback = null) {
    return valueObject?.value ?? fallback;
}

function modeFor(value) {
    return value === EXTERNAL_STORAGE_MODE ? EXTERNAL_STORAGE_MODE : INLINE_STORAGE_MODE;
}

export function buildEmailBodyPayload(emailBody) {
    if (!emailBody) {
        return null;
    }

    const emailId = valueOf(emailBody.email_id);
    const textMode = modeFor(valueOf(emailBody.body_text_storage_mode));
    const htmlMode = modeFor(valueOf(emailBody.body_html_storage_mode));
    const textBody = valueOf(emailBody.body, '');
    const htmlBody = valueOf(emailBody.body_html);

    return {
        id: valueOf(emailBody.id),
        email_id: emailId,
        body: textBody,
        body_html: htmlMode === EXTERNAL_STORAGE_MODE ? null : htmlBody,
        text: {
            mode: textMode,
            size_bytes:
                textMode === EXTERNAL_STORAGE_MODE
                    ? valueOf(emailBody.body_text_size_bytes)
                    : Buffer.byteLength(textBody, 'utf8'),
            content_type: valueOf(emailBody.body_text_content_type),
            preview_truncated: Boolean(valueOf(emailBody.body_text_preview_truncated, false)),
            bodyUrl: textMode === EXTERNAL_STORAGE_MODE ? `/emails/${emailId}/body?part=text` : null,
        },
        html: {
            mode: htmlMode,
            size_bytes:
                htmlMode === EXTERNAL_STORAGE_MODE
                    ? valueOf(emailBody.body_html_size_bytes)
                    : htmlBody
                      ? Buffer.byteLength(htmlBody, 'utf8')
                      : null,
            content_type: valueOf(emailBody.body_html_content_type),
            preview_truncated: Boolean(valueOf(emailBody.body_html_preview_truncated, false)),
            bodyUrl: htmlMode === EXTERNAL_STORAGE_MODE ? `/emails/${emailId}/body?part=html` : null,
        },
        created_at: valueOf(emailBody.created_at),
        created_by: valueOf(emailBody.created_by),
        updated_at: valueOf(emailBody.updated_at),
        updated_by: valueOf(emailBody.updated_by),
    };
}
