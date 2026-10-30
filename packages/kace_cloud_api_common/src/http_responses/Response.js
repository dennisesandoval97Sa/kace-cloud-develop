import Joi from 'joi';
import { CustomError, ValidationFailError, DomainError, Helper, QueryDBError } from '@kace/core/src/shared/index.js';
import AuthFailError from '@kace/core/src/shared/errors/AuthFailError.js';
import {
    AUTHORIZATION_ERROR,
    BAD_REQUEST_ERROR,
    CONFLICT_ERROR,
    DATABASE_ERROR,
    GENERAL_INTERNAL_ERROR,
    AUTH_NOT_USER_AUTHENTICATED,
    METHOD_NOT_ALLOWED_ERROR,
    NOT_FOUND_ERROR,
    REQUEST_TIMEOUT_ERROR,
    TENANT_CONTEXT_ERROR,
    VALIDATION_ERROR,
} from '@kace/error-codes';
import { MAX_SAFE_RESPONSE_BYTES, PRECISE_CHECK_FLOOR_BYTES } from './payloadLimits.js';
import {
    normalizeResponseValue,
    parseAllowedOrigins,
    parsePublicData,
    parseResponseData,
    parseResponseHeaders,
    parseResponseMessage,
    parseResponseMetadata,
    parseResponseStatusCode,
} from './ResponseBoundary.js';

const SAFE_MESSAGES = {
    DATABASE: 'Data processing error',
    VALIDATION: 'The request could not be processed.',
    DEFAULT: 'An unexpected error occurred. Please contact support.',
    SECURITY: 'Authentication required',
    AUTHORIZATION: 'Forbidden',
    BAD_REQUEST: 'Bad request',
    NOT_FOUND: 'Not found',
    METHOD_NOT_ALLOWED: 'Method not allowed',
    CONFLICT: 'Conflict',
    REQUEST_TIMEOUT: 'Request timeout',
};
const version = process.env.API_VERSION || 'unknown';

/**
 * Parses a debug toggle coming from an environment variable.
 *
 * Mirrors Helper.parseBoolEnv so the response debug gate and the logging debug
 * gate recognize exactly the same values.
 *
 * @param {string|undefined} value
 * @returns {boolean|null} null when the value is not a recognized boolean.
 */
function parseBoolEnv(value) {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;

    return null;
}

const PRODUCTION_RUNTIME_VALUES = new Set(['production', 'prod']);

export class Response {
    #message; // is initialized in the constructor
    #metadata; // is initialized in the constructor
    #statusCode; // is initialized in the constructor
    #headers; // is initialized in the constructor
    #data; // is initialized in the constructor
    #errors; // is initialized in the constructor
    #event; // is initialized in the constructor
    #publicErrorCode; // is initialized in the constructor
    #publicData; // is initialized in the constructor
    #canExposeDetailedErrors; // is initialized in the constructor
    #exposePublicErrorDetails; // is initialized in the constructor
    #rawErrors; // is initialized in the constructor
    #originalMessage; // is initialized in the constructor

    /**
     * Creates an instance of the Response class.
     *
     * @param {Object} params - The parameters for the response.
     * @param {string} [params.message=''] - The message for the response.
     * @param {number} [params.statusCode=200] - The HTTP status code for the response.
     * @param {Object} [params.data={}] - The data for the response.
     * @param {Object} [params.metadata={}] - The metadata for the response.
     * @param {Object|null} [params.errors=null] - The errors for the response.
     * @param {string|null} [params.event=null] - The event of the request.
     * @param {boolean} [params.exposePublicErrorDetails=false] - Intentionally expose non-sensitive public diagnostics.
     */
    constructor({
        message = 'Success',
        statusCode = 200,
        data = {},
        metadata = {},
        errors = null,
        event = null,
        headers = {},
        publicErrorCode = null,
        publicData = null,
        exposePublicErrorDetails = false,
    }) {
        const responseName = this.constructor.name;
        const parsedData = parseResponseData(data, responseName);
        const parsedMetadata = parseResponseMetadata(metadata, responseName);
        const parsedHeaders = parseResponseHeaders(headers, responseName);

        this.#event = event ?? {};
        this.#publicErrorCode = publicErrorCode ?? parsedData?.code ?? null;
        this.#publicData = parsePublicData(publicData, responseName);
        this.#exposePublicErrorDetails = exposePublicErrorDetails === true;
        this.#canExposeDetailedErrors = this.#resolveCanExposeDetailedErrors();
        this.#rawErrors = errors;
        this.#originalMessage = message;
        this.message = message;
        this.statusCode = statusCode;
        this.data = parsedData;
        this.metadata = { ...parsedMetadata, version };

        this.errors = errors;
        this.#finalizePublicError();

        const allowedHeaders = [
            'Authorization',
            'Content-Type',
            'X-Amz-Date',
            'X-Amz-Security-Token',
            'X-Amz-User-Agent',
            'X-Api-Key',
            'X-Client-Fingerprint',
            'X-Kace-User-Agent',
            'User-Agent',
            'X-Public-Key',
            'X-Tenant-Id',
        ];
        const validOrigin = this.getValidOrigin();
        const corsHeaders = {
            'Access-Control-Allow-Origin': validOrigin,
        };

        if (validOrigin !== '*') {
            corsHeaders['Access-Control-Allow-Credentials'] = 'true';
        }

        this.#headers = {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'cache-control': 'no-store, no-cache',
            'Access-Control-Allow-Headers': allowedHeaders.join(','),
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Max-Age': 86400,
            ...corsHeaders,
            ...parsedHeaders,
        };
    }

    get event() {
        return this.#event;
    }

    get headers() {
        return this.#headers;
    }

    get message() {
        return this.#message;
    }

    set message(value) {
        this.#message = parseResponseMessage(value);
    }

    get statusCode() {
        return this.#statusCode;
    }

    set statusCode(value) {
        this.#statusCode = parseResponseStatusCode(value, this.constructor.name);
    }

    get data() {
        return this.#data;
    }

    set data(value) {
        this.#data = parseResponseData(value, this.constructor.name);
    }

    get metadata() {
        return this.#metadata;
    }

    set metadata(value) {
        this.#metadata = parseResponseMetadata(value, this.constructor.name);
    }

    get errors() {
        return this.#errors;
    }

    set errors(value) {
        this.#errors = this.#getErrorMessage(value);
    }

    get publicErrorCode() {
        return this.#publicErrorCode;
    }

    addHeaders(headers) {
        const parsedHeaders = parseResponseHeaders(headers, this.constructor.name);
        this.#headers = {
            ...this.#headers,
            ...parsedHeaders,
        };
    }

    #isErrorResponse() {
        return this.statusCode >= 400;
    }

    #getRequestId() {
        return (
            this.event?.kContext?.awsRequestId ??
            this.event?.kContext?.requestId ??
            this.event?.requestContext?.requestId ??
            'unknown'
        );
    }

    #getTenant() {
        return this.#event?.tenantContext?.tenant ?? this.#event?.tenant;
    }

    #isTenantDebugEnabled() {
        const tenant = this.#getTenant();
        const value = tenant?.apps_debug?.value ?? tenant?.apps_debug;

        return value === true || value === 'true' || value === '1';
    }

    /**
     * Resolves the effective debug state, using the same chain as
     * Helper.isDebugEnabled() so one deploy-time switch drives logs and
     * responses alike (higher wins):
     *   1. process.env.APPS_DEBUG — deploy-time toggle injected by KApiStack
     *   2. process.env.APPS_DEBUG_OVERRIDE — deprecated alias kept for parity
     *   3. tenant.apps_debug — per-tenant DynamoDB attribute
     *
     * Recognized env values: 'true'/'1' enable, 'false'/'0' disable. Anything
     * else (including '' or unset) falls through to the next level.
     */
    #isDebugEnabled() {
        const fromEnv = parseBoolEnv(process.env.APPS_DEBUG);
        if (fromEnv !== null) return fromEnv;

        const fromOverride = parseBoolEnv(process.env.APPS_DEBUG_OVERRIDE);
        if (fromOverride !== null) return fromOverride;

        return this.#isTenantDebugEnabled();
    }

    #getRuntimeValues() {
        return [process.env.NODE_ENV, process.env.APPS_ENVIRONMENT]
            .filter((value) => value !== undefined && value !== null && value !== '')
            .map((value) => value.toString().toLowerCase());
    }

    #isNonProductionRuntime() {
        const runtimes = this.#getRuntimeValues();

        return runtimes.length > 0 && !runtimes.some((runtime) => PRODUCTION_RUNTIME_VALUES.has(runtime));
    }

    /**
     * Debug only ever unlocks response detail outside production. Production
     * responses stay generic no matter how the debug chain resolves; the
     * withheld detail is logged instead, correlated by request id.
     */
    #resolveCanExposeDetailedErrors() {
        return this.#isNonProductionRuntime() && this.#isDebugEnabled();
    }

    #canExposeResponseErrors() {
        return this.#canExposeDetailedErrors || this.#exposePublicErrorDetails;
    }

    #setPublicErrorCode(code) {
        this.#publicErrorCode = code;
        this.data = {
            ...this.data,
            code,
        };
    }

    #getPublicErrorCodeForStatus(statusCode) {
        if (statusCode === 400) return BAD_REQUEST_ERROR;
        if (statusCode === 401) return AUTH_NOT_USER_AUTHENTICATED;
        if (statusCode === 403) return AUTHORIZATION_ERROR;
        if (statusCode === 404) return NOT_FOUND_ERROR;
        if (statusCode === 405) return METHOD_NOT_ALLOWED_ERROR;
        if (statusCode === 408) return REQUEST_TIMEOUT_ERROR;
        if (statusCode === 409) return CONFLICT_ERROR;

        return GENERAL_INTERNAL_ERROR;
    }

    #getSafeMessageForCode(code) {
        if (code === VALIDATION_ERROR || code?.startsWith?.('0x0300')) return SAFE_MESSAGES.VALIDATION;
        if (code === DATABASE_ERROR) return SAFE_MESSAGES.DATABASE;
        if (code === BAD_REQUEST_ERROR) return SAFE_MESSAGES.BAD_REQUEST;
        if (code === NOT_FOUND_ERROR) return SAFE_MESSAGES.NOT_FOUND;
        if (code === METHOD_NOT_ALLOWED_ERROR) return SAFE_MESSAGES.METHOD_NOT_ALLOWED;
        if (code === CONFLICT_ERROR) return SAFE_MESSAGES.CONFLICT;
        if (code === REQUEST_TIMEOUT_ERROR) return SAFE_MESSAGES.REQUEST_TIMEOUT;
        if (code === AUTHORIZATION_ERROR) return SAFE_MESSAGES.AUTHORIZATION;
        if (code === TENANT_CONTEXT_ERROR) {
            return this.statusCode === 404 ? SAFE_MESSAGES.NOT_FOUND : SAFE_MESSAGES.BAD_REQUEST;
        }
        if (code?.startsWith?.('0x0600')) return SAFE_MESSAGES.BAD_REQUEST;
        if (code?.startsWith?.('0x0700')) return SAFE_MESSAGES.SECURITY;

        return SAFE_MESSAGES.DEFAULT;
    }

    #formatJoiDetails(error) {
        return error.details.map((detail) => {
            return {
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type,
            };
        });
    }

    #finalizePublicError() {
        if (!this.#isErrorResponse()) {
            return;
        }

        const code = this.#publicErrorCode ?? this.#getPublicErrorCodeForStatus(this.statusCode);
        this.#setPublicErrorCode(code);

        if (!this.#canExposeResponseErrors()) {
            this.message = this.#getSafeMessageForCode(code);
            this.#errors = null;
            this.#logSuppressedErrorDetail(code);
        }
    }

    /**
     * Builds the validation breakdown withheld from the response, if any.
     *
     * @returns {Array<Object>|undefined}
     */
    #suppressedValidationDetail() {
        const errors = this.#rawErrors;

        if (errors instanceof Joi.ValidationError) {
            return this.#formatJoiDetails(errors);
        }

        if (errors instanceof ValidationFailError) {
            return [{ field: errors.field, message: errors.message }];
        }

        return undefined;
    }

    /**
     * Writes the diagnostics the public response withholds to the service log.
     *
     * The client only receives a generic message plus a public error code, so
     * this entry is the sole place where the real cause survives. It is keyed by
     * request_id so support can correlate a reported failure with its cause.
     *
     * @param {string} code - The public error code sent to the client.
     */
    #logSuppressedErrorDetail(code) {
        const errors = this.#rawErrors;
        const validation = this.#suppressedValidationDetail();
        const detail = {
            request_id: this.#getRequestId(),
            public_error_code: code,
            status_code: this.statusCode,
        };

        const resource = this.#event?.resource;
        if (resource) {
            detail.resource = resource;
        }

        const httpMethod = this.#event?.httpMethod;
        if (httpMethod) {
            detail.http_method = httpMethod;
        }

        const isSafeDefaultMessage = Object.values(SAFE_MESSAGES).includes(this.#originalMessage);
        if (this.#originalMessage && !isSafeDefaultMessage && this.#originalMessage !== this.message) {
            detail.original_message = this.#originalMessage;
        }

        // A Joi error's message and stack only describe the wrapper, so the
        // breakdown below carries everything worth reading.
        const isJoiWrapper = errors instanceof Joi.ValidationError;
        if (errors instanceof Error && !isJoiWrapper) {
            detail.error = errors.message;
            detail.error_name = errors.name;
            if (errors.stack) {
                detail.stack = errors.stack;
            }
        } else {
            const normalizedErrors = normalizeResponseValue(errors);
            if (normalizedErrors.kind === 'string') {
                detail.error = normalizedErrors.value;
            }
        }

        if (validation) {
            detail.validation = validation;
        }

        Helper.logError('Response::suppressedErrorDetail', detail);
    }

    #getErrorMessage(errors) {
        const canExposeDetails = this.#canExposeDetailedErrors;

        if (errors instanceof Joi.ValidationError) {
            this.#setPublicErrorCode(this.#publicErrorCode ?? errors.publicErrorCode ?? VALIDATION_ERROR);
            this.message = SAFE_MESSAGES.VALIDATION;
            this.statusCode = 400;

            return canExposeDetails ? this.#formatJoiDetails(errors) : null;
        }

        if (errors instanceof ValidationFailError) {
            this.#setPublicErrorCode(this.#publicErrorCode ?? errors.publicErrorCode ?? VALIDATION_ERROR);
            this.message = SAFE_MESSAGES.VALIDATION;
            this.statusCode = 400;
            if (this.#publicData == null && errors.constructor?.exposesPublicData === true) {
                this.#publicData = errors.toPublicData();
            }

            return canExposeDetails
                ? [
                      {
                          field: errors.field,
                          message: errors.message,
                      },
                  ]
                : null;
        }

        if (errors instanceof AuthFailError) {
            this.#setPublicErrorCode(errors.errorCode);
            this.message = canExposeDetails ? errors.message : SAFE_MESSAGES.SECURITY;
            this.statusCode = errors.statusCode;

            return canExposeDetails ? errors.message : null;
        }

        if (errors instanceof QueryDBError) {
            this.#setPublicErrorCode(DATABASE_ERROR);
            this.message = canExposeDetails ? errors.message : SAFE_MESSAGES.DATABASE;
            this.statusCode = errors.statusCode;

            return canExposeDetails ? errors.message : null;
        }

        if (errors instanceof CustomError || errors instanceof DomainError) {
            this.statusCode = errors.statusCode;
            this.#setPublicErrorCode(
                this.#publicErrorCode ?? errors.publicErrorCode ?? this.#getPublicErrorCodeForStatus(errors.statusCode)
            );
            this.message = canExposeDetails ? errors.message : this.#getSafeMessageForCode(this.#publicErrorCode);
            if (this.#publicData == null && errors.constructor?.exposesPublicData === true) {
                this.#publicData = errors.toPublicData();
            }

            return canExposeDetails ? errors.message : null;
        }

        if (errors instanceof Error) {
            this.#setPublicErrorCode(this.#publicErrorCode ?? this.#getPublicErrorCodeForStatus(this.statusCode));
            this.message = canExposeDetails ? errors.message : this.#getSafeMessageForCode(this.#publicErrorCode);

            return canExposeDetails ? errors.message : null;
        }

        if (this.#isErrorResponse() && !this.#canExposeResponseErrors()) {
            return null;
        }

        return errors;
    }

    toJson() {
        const dbKeywords = [
            'select',
            'insert',
            'update',
            'delete',
            'from',
            'where',
            'table',
            'column',
            'join',
            'schema',
            'database',
            'constraint',
            'null',
            'is null',
            'is not null',
            'order by',
            'group by',
            'foreign key',
            'transaction',
            'duplicate key',
            'primary key',
        ];

        const containsSensitiveData = (text) => {
            if (!text) {
                return false;
            }
            return dbKeywords.some((keyword) => {
                const result = new RegExp(`\\b${keyword}\\b`, 'i').test(text.toLowerCase());
                if (result) {
                    Helper.logDebug(`Response::containsSensitiveData - Error message contains sensitive data: ${text}`);
                }

                return result;
            });
        };

        const sanitizeMessage = (message) => {
            const normalizedMessage = normalizeResponseValue(message);
            if (normalizedMessage.kind !== 'string') {
                return message;
            }

            return containsSensitiveData(normalizedMessage.value) ? SAFE_MESSAGES.DEFAULT : normalizedMessage.value;
        };

        const sanitizeErrors = (errors) => {
            if (!errors) return [];

            if (Array.isArray(errors)) {
                return errors.map((err) => {
                    if (err instanceof Joi.ValidationError) {
                        const joiError = {};
                        err.details.forEach((error) => {
                            joiError.field = error.path[0];
                            joiError.message = error.message;
                        });
                        return joiError;
                    }
                    const normalizedError = normalizeResponseValue(err);
                    if (normalizedError.kind === 'string' && containsSensitiveData(normalizedError.value)) {
                        return SAFE_MESSAGES.DEFAULT;
                    }
                    if (normalizedError.kind === 'record') {
                        const record = normalizedError.value;
                        const sanitizedError = {
                            message: sanitizeMessage(record.message),
                        };
                        if (record.code) {
                            sanitizedError.code = record.code;
                        }
                        if (record.field) {
                            sanitizedError.field = record.field;
                        } else if (!record.code) {
                            sanitizedError.field = 'unknown';
                        }
                        if (record.type) {
                            sanitizedError.type = record.type;
                        }
                        return sanitizedError;
                    }
                    return err;
                });
            }

            const normalizedErrors = normalizeResponseValue(errors);
            if (normalizedErrors.kind === 'string' && containsSensitiveData(normalizedErrors.value)) {
                return [SAFE_MESSAGES.DEFAULT];
            }

            return errors;
        };

        const publicCompatibilityErrors = () => [
            {
                code: this.#publicErrorCode,
                message: this.message,
            },
        ];

        const isPublicError = this.#isErrorResponse() && Boolean(this.#publicErrorCode);
        const canExposeDetails = this.#canExposeDetailedErrors;
        const canExposeResponseErrors = this.#canExposeResponseErrors();
        const requestMetadata = {
            request_id: this.#getRequestId(),
        };

        let responseData = this.data ?? {};
        if (isPublicError && !canExposeDetails) {
            responseData = { code: this.#publicErrorCode };
            if (this.#publicData) {
                responseData = { ...responseData, ...this.#publicData };
            }
        }

        const responseBody = {
            ...this.responseBodyExtras(),
            message: this.message,
            data: responseData,
        };

        if (this.metadata) {
            responseBody.metadata =
                isPublicError && !canExposeDetails
                    ? requestMetadata
                    : {
                          ...this.metadata,
                          ...requestMetadata,
                      };
        }

        if (isPublicError && !canExposeResponseErrors) {
            responseBody.errors = publicCompatibilityErrors();
        } else if (this.errors && (!isPublicError || canExposeResponseErrors)) {
            responseBody.errors = sanitizeErrors(this.errors);
        }

        const body = JSON.stringify(responseBody);
        const envelope = {
            statusCode: this.statusCode,
            headers: this.headers,
            body,
        };

        if (Buffer.byteLength(body, 'utf8') >= PRECISE_CHECK_FLOOR_BYTES) {
            const wireSize = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
            if (wireSize > MAX_SAFE_RESPONSE_BYTES) {
                return this.#payloadTooLarge(wireSize);
            }
        }

        return envelope;
    }

    responseBodyExtras() {
        return {};
    }

    #payloadTooLarge(size) {
        const requestId = this.event?.kContext?.awsRequestId ?? 'unknown';
        Helper.logError('PAYLOAD_TOO_LARGE', {
            size_bytes: size,
            limit_bytes: MAX_SAFE_RESPONSE_BYTES,
            request_id: requestId,
        });

        return {
            statusCode: 413,
            headers: this.headers,
            body: JSON.stringify({
                message: 'Response payload too large',
                error: 'PAYLOAD_TOO_LARGE',
                metadata: { size_bytes: size, limit_bytes: MAX_SAFE_RESPONSE_BYTES, request_id: requestId },
            }),
        };
    }

    /**
     * Is the response informational?
     *
     * @returns {boolean}
     */
    isInformational() {
        return this.statusCode >= 100 && this.statusCode < 200;
    }

    /**
     * Is the response successful?
     *
     * @returns {boolean}
     */
    isSuccessful() {
        return this.statusCode >= 200 && this.statusCode < 300;
    }

    /**
     * Is the response a redirect?
     *
     * @returns {boolean}
     */
    isRedirection() {
        return this.statusCode >= 300 && this.statusCode < 400;
    }

    /**
     * Is there a client error?
     *
     * @returns {boolean}
     */
    isClientError() {
        return this.statusCode >= 400 && this.statusCode < 500;
    }

    /**
     * Was there a server-side error?
     *
     * @returns {boolean}
     */
    isServerError() {
        return this.statusCode >= 500 && this.statusCode < 600;
    }

    /**
     * Is the response OK?
     *
     * @returns {boolean}
     */
    isOk() {
        return this.statusCode === 200;
    }

    /**
     * Is the response forbidden?
     *
     * @returns {boolean}
     */
    isForbidden() {
        return this.statusCode === 403;
    }

    /**
     * Is the response a not found error?
     *
     * @returns {boolean}
     */
    isNotFound() {
        return this.statusCode === 404;
    }

    getValidOrigin() {
        const origin = this.#getRequestOrigin();
        const allowedOrigins = this.#getAllowedOrigins();
        const result = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

        Helper.logDebug(
            `Response::getValidOrigin RESULT ${result} - origin: ${origin}, allowedOrigins: ${allowedOrigins}`
        );
        return result;
    }

    #getRequestOrigin() {
        const headers = this.#event?.headers ?? {};
        const originHeader = Object.keys(headers).find((header) => header.toLowerCase() === 'origin');

        return originHeader ? headers[originHeader] : undefined;
    }

    #getAllowedOrigins() {
        const tenant = this.#event?.tenantContext?.tenant ?? this.#event?.tenant;
        const value = tenant?.apps_allowed_origins?.value ?? tenant?.apps_allowed_origins;

        return parseAllowedOrigins(value);
    }
}
