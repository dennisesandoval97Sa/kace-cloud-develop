import { CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES } from '@kace/core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailErrorCodes.js';
import { S3_FILE_SCAN_ERROR_CODES } from '@kace/core/src/s3-files/domain/S3FileScanErrorCodes.js';
import { HttpResponse } from './HttpResponse.js';
import { Response } from './Response.js';

const CONNECTION_WORKSPACE_INCONSISTENCY_CODE = 'inconsistent_channel_hub_connection_workspace';
const CONNECTION_WORKSPACE_INCONSISTENCY_MESSAGE =
    'Channel Hub connectionId and tag match multiple workspaces in KACE.';
const SUBJECT_TOO_LONG = 'SUBJECT_TOO_LONG';
const RECIPIENT_INVALID = 'RECIPIENT_INVALID';
const SENDER_INVALID = 'SENDER_INVALID';
const MAX_REFLECTED_ADDRESS_LENGTH = 120;
const BODY_TOO_LARGE_ERROR = { code: 'BODY_TOO_LARGE', statusCode: 400 };
const SEMANTIC_PROCESSING_ERRORS = {
    [CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.SUBJECT_FORBIDDEN_WORD]: {
        code: 'SUBJECT_FORBIDDEN_WORD',
        statusCode: 400,
        publicMessage: 'Subject contains a forbidden word · SUBJECT_FORBIDDEN_WORD',
    },
    [CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.TEXT_BODY_TOO_LARGE]: BODY_TOO_LARGE_ERROR,
    [CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.HTML_BODY_TOO_LARGE]: BODY_TOO_LARGE_ERROR,
    [S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED]: { code: 'ATTACHMENT_ENCRYPTED', statusCode: 422 },
};

class ChannelHubSemanticErrorResponse extends Response {
    #semanticCode;

    constructor({ code, message, statusCode, event }) {
        super({
            message,
            statusCode,
            errors: [{ code, message }],
            event,
            publicErrorCode: code,
            exposePublicErrorDetails: true,
        });
        this.#semanticCode = code;
    }

    responseBodyExtras() {
        return { code: this.#semanticCode };
    }
}

function semanticErrorResponse({ code, message, statusCode = 400, event }) {
    return new ChannelHubSemanticErrorResponse({ code, message, statusCode, event });
}

function messageWithSemanticCode(message, code) {
    return message.endsWith(`· ${code}`) ? message : `${message} · ${code}`;
}

function semanticProcessingErrorResponse(result, event) {
    const semanticError = SEMANTIC_PROCESSING_ERRORS[result?.code];
    if (!semanticError) {
        return null;
    }
    const webhookMessage = semanticError.publicMessage ?? nonRetryableWebhookMessage(result);

    return semanticErrorResponse({
        code: semanticError.code,
        message: messageWithSemanticCode(webhookMessage, semanticError.code),
        statusCode: semanticError.statusCode,
        event,
    });
}

function valueAtPath(payload, path) {
    return path.reduce((value, segment) => value?.[segment], payload);
}

function displayAddress(value) {
    if (Array.isArray(value)) {
        return value.map(displayAddress).filter(Boolean).join(', ');
    }

    const address = value?.email ?? value?.address;
    if (address !== undefined) {
        return displayAddress(address);
    }

    const normalizedValue = String(value ?? '');
    if (normalizedValue === '[object Object]') {
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }

    return normalizedValue;
}

function reflectedAddress(detail, payload) {
    const invalidValue = detail?.context?.value ?? valueAtPath(payload, detail?.path ?? []);

    return displayAddress(invalidValue).slice(0, MAX_REFLECTED_ADDRESS_LENGTH);
}

function expandedValidationDetails(details = []) {
    return details.flatMap((detail) => [...expandedValidationDetails(detail?.context?.details), detail]);
}

function mostSpecificDetail(details, predicate) {
    return details.filter(predicate).sort((left, right) => {
        const pathDifference = right.path.length - left.path.length;
        if (pathDifference !== 0) {
            return pathDifference;
        }

        return Number(right.type.startsWith('string.')) - Number(left.type.startsWith('string.'));
    })[0];
}

function subjectTooLongResponse(error, payload, event) {
    const detail = error?.details?.find(
        (candidate) => candidate.type === 'string.max' && candidate.path.join('.') === 'subject'
    );
    if (!detail) {
        return null;
    }

    const limit = detail.context.limit;
    const receivedLength = String(payload?.subject ?? '').length;
    const message = `Subject exceeds ${limit} characters (received ${receivedLength}) · ${SUBJECT_TOO_LONG}`;

    return semanticErrorResponse({ code: SUBJECT_TOO_LONG, message, event });
}

function invalidRecipientResponse(error, payload, event) {
    const details = expandedValidationDetails(error?.details);
    const missingRecipient = details.find((candidate) => candidate.type === 'object.nonEmptyRecipient');
    if (missingRecipient) {
        return semanticErrorResponse({
            code: RECIPIENT_INVALID,
            message: `Destination must contain at least one recipient · ${RECIPIENT_INVALID}`,
            event,
        });
    }

    const detail = mostSpecificDetail(
        details,
        (candidate) => candidate.path[0] === 'destination' && ['to', 'cc', 'bcc'].includes(candidate.path[1])
    );
    if (!detail) {
        return null;
    }

    const recipient = reflectedAddress(detail, payload);
    const message = `Invalid recipient address: '${recipient}' · ${RECIPIENT_INVALID}`;

    return semanticErrorResponse({ code: RECIPIENT_INVALID, message, event });
}

function invalidSenderResponse(error, payload, event) {
    const detail = mostSpecificDetail(
        expandedValidationDetails(error?.details),
        (candidate) => candidate.path[0] === 'origin' && candidate.type !== 'any.required'
    );
    if (!detail) {
        return null;
    }

    const sender = reflectedAddress(detail, payload);
    const message = `Invalid sender address format (non-SMTP/X.500): '${sender}' · ${SENDER_INVALID}`;

    return semanticErrorResponse({ code: SENDER_INVALID, message, event });
}

function nonRetryableWebhookMessage(result) {
    if (result?.code === CONNECTION_WORKSPACE_INCONSISTENCY_CODE) {
        return CONNECTION_WORKSPACE_INCONSISTENCY_MESSAGE;
    }

    return result?.message ?? 'Channel Hub inbound email was rejected.';
}

export class ChannelHubInboundEmailWebhookResponse {
    static invalidJsonPayload(error, event) {
        return new Response({
            message: 'Invalid JSON payload',
            statusCode: 400,
            errors: {
                code: 'invalid_json_payload',
                message: error.message,
            },
            event,
            exposePublicErrorDetails: true,
        });
    }

    static invalidPayload(error, payload, event) {
        return (
            subjectTooLongResponse(error, payload, event) ??
            invalidRecipientResponse(error, payload, event) ??
            invalidSenderResponse(error, payload, event) ??
            HttpResponse.validationsFail({ errors: error, event })
        );
    }

    static fromProcessingResult(result, event) {
        if (result.accepted) {
            return HttpResponse.ok({
                message: 'Webhook received',
                data: result.data ?? {},
                event,
            });
        }

        if (result.nonRetryable) {
            const semanticResponse = semanticProcessingErrorResponse(result, event);
            if (semanticResponse) {
                return semanticResponse;
            }

            return new Response({
                message: nonRetryableWebhookMessage(result),
                statusCode: 400,
                errors: {
                    code: result.code,
                    message: result.message,
                },
                event,
                exposePublicErrorDetails: true,
            });
        }

        return HttpResponse.internalServerError({
            message: result.message ?? 'Channel Hub inbound email processing failed.',
            errors: {
                code: result.code,
                message: result.message,
            },
            event,
        });
    }
}
