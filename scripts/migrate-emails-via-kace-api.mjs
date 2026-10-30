#!/usr/bin/env node

/**
 * Import historical emails through KACE APIs.
 *
 * This script intentionally calls POST /emails, not /emails/send:
 * - /emails creates historical email records.
 * - /emails/send sends real email through Channel Hub.
 *
 * API-path behavior:
 * - body.body is capped at 5000 chars by the API schema, so this script sends a
 *   preview there.
 * - Full text-only bodies longer than 5000 chars are uploaded through
 *   /upload-s3-files and sent to POST /emails as body.text.s3_url.
 * - Very large HTML bodies are uploaded through /upload-s3-files and sent to
 *   POST /emails as body.html.s3_url.
 * - created_at/created_by are overwritten by the API controller.
 * - account_id can be provided as a Channel Hub Account id. If omitted, the API
 *   resolves it from delivered recipients when exactly one Channel Hub Account
 *   matches.
 * - thread_id cannot be set through this API.
 * - attachments are skipped by default. If KACE_IMPORT_ATTACHMENTS=true, each
 *   attachment must be a URL the API can download and scan.
 *
 * Input file:
 *   JSON array or JSONL, one object per legacy email.
 *
 * Minimal record:
 *   {
 *     "legacy_email_id": "legacy-123",
 *     "workspace_id": "workspace-uuid",
 *     "sender_email": "customer@example.com",
 *     "to": ["support@example.com"],
 *     "subject": "Legacy subject",
 *     "message_id": "legacy-provider-message-id",
 *     "received_at": "2026-01-01T10:00:00.000Z",
 *     "is_outbound": false,
 *     "body_text": "Plain text body",
 *     "body_html": "<p>Optional full html body</p>",
 *     "attachments": [
 *       { "url": "https://example.com/file.pdf", "size": 12345, "filename": "file.pdf" }
 *     ]
 *   }
 *
 * Usage:
 *   KACE_API_URL="https://staging-api.kace-cloudtest.com" \
 *   KACE_TENANT_ID="tenant-id" \
 *   KACE_AUTH_TOKEN="id-token-value" \
 *   KACE_SESSION_KEY="session-cookie-value" \
 *   KACE_INPUT_FILE="./legacy-emails.json" \
 *   KACE_DRY_RUN=false \
 *   node scripts/migrate-emails-via-kace-api.mjs
 *
 * Useful env/flags:
 *   KACE_DRY_RUN=true|false              Default true
 *   KACE_CONCURRENCY=2                   Default 2
 *   KACE_RESULT_FILE=./tmp/...json       Import report
 *   KACE_STATE_FILE=./tmp/...state.json  Stable generated IDs for retries
 *   KACE_WORKSPACE_ID=uuid               Default workspace if missing per row
 *   KACE_COOKIE="session_key=..."        Optional full Cookie header for AD sessions
 *   KACE_SESSION_KEY=value               Optional session_key cookie value for AD sessions
 *   KACE_MAX_INLINE_HTML_BYTES=921600    Upload bigger body_html externally
 *   KACE_SKIP_EXISTING_SEARCH=true       Search /emails before POST, default true
 *   KACE_IMPORT_ATTACHMENTS=false        Include attachment URLs, default false
 *   KACE_FORCE_EXTERNAL_BODIES=false     Upload body text/html even when inline is allowed
 *   --stdin                              Read one email JSON from stdin and print one JSON result
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BODY_PREVIEW_MAX_CHARS = 5000;
const SUBJECT_MAX_CHARS = 120;
const SENDER_MAX_CHARS = 120;
const MESSAGE_ID_MAX_CHARS = 255;
const THREAD_ID_MAX_CHARS = 255;
const RECIPIENT_NAME_MAX_CHARS = 100;
const ATTACHMENT_URL_MAX_CHARS = 1000;
const ATTACHMENT_FILENAME_MAX_CHARS = 255;
const DEFAULT_HTML_MAX_BYTES = 900 * 1024;
const TEXT_BODY_CONTENT_TYPE = 'text/plain; charset=utf-8';
const HTML_BODY_CONTENT_TYPE = 'text/html; charset=utf-8';
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    if (process.argv.slice(2).includes('--stdin')) {
        writeStdoutJson({
            status: 'failed',
            legacy_email_id: null,
            email_id: null,
            message_id: null,
            warnings: [],
            external_body_uploads: [],
            error: serializeError(error),
        });
    }
    process.exitCode = 1;
});

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printUsage();
        return;
    }

    const config = buildConfig(args);
    ensureRunnableConfig(config);

    if (config.stdin) {
        await runStdinMode(config);
        return;
    }

    await runBatchMode(config);
}

async function runBatchMode(config) {
    const records = await readRecords(config.inputFile);
    const state = await readState(config.stateFile);
    const results = [];

    console.info(`Loaded ${records.length} email record(s) from ${config.inputFile}`);
    console.info(`Mode: ${config.dryRun ? 'dry-run' : 'import'}`);

    await runPool(records, config.concurrency, async (record, index) => {
        const result = await processRecord({ record, index, config, state });
        results[index] = result;

        if (shouldPersistState(config)) {
            await writeJsonFile(config.stateFile, state);
        }

        const label = result.legacy_email_id || `#${index + 1}`;
        const status = result.status.toUpperCase();
        console.info(`[${index + 1}/${records.length}] ${status} ${label} ${result.email_id || ''}`);
    });

    const summary = summarize(results);
    await writeJsonFile(config.resultFile, {
        generated_at: new Date().toISOString(),
        dry_run: config.dryRun,
        input_file: config.inputFile,
        summary,
        results,
    });

    console.info(`Result written to ${config.resultFile}`);
    console.info(JSON.stringify(summary, null, 2));

    if (summary.failed > 0) {
        process.exitCode = 1;
    }
}

async function runStdinMode(config) {
    try {
        const record = await readRecordFromStdin();
        const state = config.stateFileExplicit ? await readState(config.stateFile) : { records: {} };
        const result = await processRecord({ record, index: 0, config, state });

        if (shouldPersistState(config)) {
            await writeJsonFile(config.stateFile, state);
        }

        writeStdoutJson(toChildProcessResult(result));

        if (result.status === 'failed') {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(error?.stack || error?.message || String(error));
        writeStdoutJson({
            status: 'failed',
            legacy_email_id: null,
            email_id: null,
            message_id: null,
            warnings: [],
            external_body_uploads: [],
            error: serializeError(error),
        });
        process.exitCode = 1;
    }
}

async function processRecord({ record, index, config, state }) {
    let prepared;
    try {
        prepared = prepareEmailPayload({ record, index, config, state });

        if (config.dryRun) {
            return {
                status: 'dry_run',
                legacy_email_id: prepared.legacyEmailId,
                email_id: prepared.payload.id,
                message_id: prepared.payload.message_id,
                warnings: prepared.warnings,
                external_body_uploads: summarizeExternalBodyPlan(prepared.bodyPlan),
                payload: prepared.payload,
            };
        }

        if (config.skipExistingSearch) {
            const existing = await findExistingEmail({
                config,
                workspaceId: prepared.payload.workspace_id,
                messageId: prepared.payload.message_id,
            });

            if (existing) {
                state.records[prepared.legacyEmailId].emailId = existing.id || prepared.payload.id;
                return {
                    status: 'skipped_existing',
                    legacy_email_id: prepared.legacyEmailId,
                    email_id: existing.id || prepared.payload.id,
                    message_id: prepared.payload.message_id,
                    warnings: prepared.warnings,
                };
            }
        }

        const externalBodyUploads = await uploadExternalBodyParts({ prepared, config, state });
        if (externalBodyUploads.length && shouldPersistState(config)) {
            await writeJsonFile(config.stateFile, state);
        }

        const response = await postJson(config, '/emails', prepared.payload);
        const emailId = emailIdFromCreateResponse(response) || prepared.payload.id;
        state.records[prepared.legacyEmailId].emailId = emailId;

        return {
            status: 'created',
            legacy_email_id: prepared.legacyEmailId,
            email_id: emailId,
            message_id: prepared.payload.message_id,
            warnings: prepared.warnings,
            external_body_uploads: externalBodyUploads,
            response,
        };
    } catch (error) {
        return {
            status: 'failed',
            legacy_email_id: legacyIdFor(record, index),
            email_id: prepared?.payload?.id ?? null,
            message_id:
                prepared?.payload?.message_id ?? emptyToNull(stringValue(record?.message_id ?? record?.messageId)),
            warnings: prepared?.warnings ?? [],
            error: serializeError(error),
            external_body_uploads: prepared ? uploadedBodyObjectsFor(prepared.legacyEmailId, state) : [],
        };
    }
}

function prepareEmailPayload({ record, index, config, state }) {
    const warnings = [];
    const legacyEmailId = legacyIdFor(record, index);
    const ids = ensureStableIds({ state, legacyEmailId, record });

    const workspaceId = stringValue(record.workspace_id ?? record.workspaceId ?? config.defaultWorkspaceId);
    if (!workspaceId) {
        throw new Error('workspace_id is required in the record or KACE_WORKSPACE_ID.');
    }

    const accountId = emptyToNull(
        stringValue(
            record.account_id ?? record.accountId ?? record.channel_hub_account_id ?? record.channelHubAccountId
        )
    );

    const sender = stringValue(record.sender_email ?? record.sender ?? record.from);
    if (!sender) {
        throw new Error('sender_email/sender/from is required.');
    }
    if (sender.length > SENDER_MAX_CHARS) {
        throw new Error(`sender_email exceeds ${SENDER_MAX_CHARS} chars: ${sender}`);
    }

    const messageId = stringValue(record.message_id ?? record.messageId) || `legacy:${legacyEmailId}`;
    if (messageId.length > MESSAGE_ID_MAX_CHARS) {
        throw new Error(`message_id exceeds ${MESSAGE_ID_MAX_CHARS} chars.`);
    }

    const threadId = emptyToNull(stringValue(record.thread_id ?? record.threadId));
    if (threadId && threadId.length > THREAD_ID_MAX_CHARS) {
        throw new Error(`thread_id exceeds ${THREAD_ID_MAX_CHARS} chars.`);
    }
    if (threadId) {
        warnings.push('thread_id omitted because generic POST /emails does not accept it');
    }

    const subjectRaw = stringValue(record.subject) || 'No subject';
    const subject = truncate(subjectRaw, SUBJECT_MAX_CHARS);
    if (subject.length !== subjectRaw.length) {
        warnings.push(`subject truncated to ${SUBJECT_MAX_CHARS} chars`);
    }

    const bodyPlan = buildBody(record, config, warnings);
    const attachments = buildAttachments({ record, ids, config, warnings });
    const isOutbound = optionalBoolean(record.is_outbound ?? record.isOutbound, 'is_outbound');

    return {
        legacyEmailId,
        warnings,
        bodyPlan,
        payload: {
            id: ids.emailId,
            subject,
            sender,
            to: normalizeRecipients(record.to_recipients ?? record.to ?? record.destination?.to),
            cc: normalizeRecipients(record.cc_recipients ?? record.cc ?? record.destination?.cc),
            bcc: normalizeRecipients(record.bcc_recipients ?? record.bcc ?? record.destination?.bcc),
            priority: stringValue(record.priority) || 'normal',
            workspace_id: workspaceId,
            message_id: messageId,
            ...(accountId ? { account_id: accountId } : {}),
            ...(isOutbound === null ? {} : { is_outbound: isOutbound }),
            received_at:
                toIsoDate(record.received_at ?? record.receivedAt ?? record.created_at) ?? new Date().toISOString(),
            body: {
                id: ids.bodyId,
                body: bodyPlan.preview,
                body_html: bodyPlan.html,
            },
            attachments,
        },
    };
}

function buildBody(record, config, warnings) {
    const rawHtml = firstNonEmptyString(record.body_html, record.bodyHtml, record.html_body, record.html);
    const rawText =
        firstString(record.body_text, record.bodyText, record.plain_text, record.text, record.body) ??
        (rawHtml ? stripHtmlToText(rawHtml) : '');

    let html = rawHtml || null;
    let preview = rawText || (rawHtml ? stripHtmlToText(rawHtml) : '');
    const external = {
        text: null,
        html: null,
    };

    if (preview.length > BODY_PREVIEW_MAX_CHARS) {
        warnings.push(`body.body truncated to ${BODY_PREVIEW_MAX_CHARS} chars`);
        preview = preview.slice(0, BODY_PREVIEW_MAX_CHARS);
    }

    if (rawText && (rawText.length > BODY_PREVIEW_MAX_CHARS || config.forceExternalBodies)) {
        external.text = {
            content: rawText,
            contentType: TEXT_BODY_CONTENT_TYPE,
        };
        warnings.push('full plain-text body will be uploaded as body.text.s3_url');
    }

    if (!preview) {
        preview = ' ';
        warnings.push('empty body replaced with a single-space preview to satisfy API validation');
    }

    if (html && (byteLength(html) > config.maxInlineHtmlBytes || config.forceExternalBodies)) {
        external.html = {
            content: html,
            contentType: HTML_BODY_CONTENT_TYPE,
        };
        html = null;
        warnings.push('full HTML body will be uploaded as body.html.s3_url');
    }

    return { preview, html, external };
}

function buildAttachments({ record, ids, config, warnings }) {
    const raw = record.attachments ?? [];
    const values = Array.isArray(raw) ? raw : [];

    if (!config.importAttachments) {
        if (values.length > 0) {
            warnings.push(
                `skipped ${values.length} attachment(s); set KACE_IMPORT_ATTACHMENTS=true to include downloadable URLs`
            );
        }
        return [];
    }

    return values
        .map((attachment) => {
            const normalized =
                typeof attachment === 'string'
                    ? { url: attachment }
                    : {
                          url: attachment?.url,
                          size: attachment?.size,
                          filename: attachment?.filename ?? attachment?.name ?? attachment?.fileName,
                      };

            const url = stringValue(normalized.url);
            if (!url) {
                return null;
            }

            assertUri(url, 'attachment.url');
            if (url.length > ATTACHMENT_URL_MAX_CHARS) {
                throw new Error(`attachment.url exceeds ${ATTACHMENT_URL_MAX_CHARS} chars: ${url}`);
            }

            const key = `${url}|${stringValue(normalized.filename)}`;
            const id = ids.attachmentIdsByKey[key] ?? randomUUID();
            ids.attachmentIdsByKey[key] = id;

            return {
                id,
                url,
                size: toNonNegativeInteger(normalized.size) ?? 0,
                filename: truncate(emptyToNull(stringValue(normalized.filename)), ATTACHMENT_FILENAME_MAX_CHARS),
            };
        })
        .filter(Boolean);
}

function normalizeRecipients(value) {
    const list = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value
                .split(/[;,]/)
                .map((item) => item.trim())
                .filter(Boolean)
          : value
            ? [value]
            : [];

    return list
        .map((recipient) => {
            if (typeof recipient === 'string') {
                const email = recipient.trim();
                return email ? { email, name: defaultRecipientName(email) } : null;
            }

            const email = stringValue(recipient?.email ?? recipient?.address ?? recipient?.value);
            if (!email) {
                return null;
            }

            return {
                email,
                name: truncate(
                    stringValue(recipient?.name ?? recipient?.label ?? recipient?.displayName) ||
                        defaultRecipientName(email),
                    RECIPIENT_NAME_MAX_CHARS
                ),
            };
        })
        .filter(Boolean);
}

function ensureStableIds({ state, legacyEmailId, record }) {
    state.records ??= {};
    state.records[legacyEmailId] ??= {};

    const entry = state.records[legacyEmailId];

    entry.emailId =
        entry.emailId ||
        validUuid(record.target_email_id) ||
        validUuid(record.targetEmailId) ||
        validUuid(record.kace_email_id) ||
        randomUUID();

    entry.bodyId = entry.bodyId || validUuid(record.target_body_id) || validUuid(record.targetBodyId) || randomUUID();

    entry.attachmentIdsByKey ??= {};
    entry.bodyUploads ??= {};

    return {
        emailId: entry.emailId,
        bodyId: entry.bodyId,
        attachmentIdsByKey: entry.attachmentIdsByKey,
        bodyUploads: entry.bodyUploads,
    };
}

async function findExistingEmail({ config, workspaceId, messageId }) {
    const response = await postJson(config, '/emails/search', {
        filter: [
            { field: 'emails.workspace_id', operator: 'eq', value: workspaceId, type: 'AND' },
            { field: 'emails.message_id', operator: 'eq', value: messageId, type: 'AND' },
        ],
        limit: 1,
        offset: 0,
        order: null,
    });

    const items = response?.data?.items ?? response?.data?.data?.items ?? [];
    return items[0] ?? null;
}

function emailIdFromCreateResponse(response) {
    const body = typeof response?.body === 'string' ? parseJsonSafely(response.body) : null;
    return (
        response?.data?.id ?? response?.data?.data?.id ?? response?.id ?? body?.data?.id ?? body?.data?.data?.id ?? null
    );
}

async function uploadExternalBodyParts({ prepared, config, state }) {
    const uploads = [];

    for (const part of ['text', 'html']) {
        const candidate = prepared.bodyPlan.external[part];
        if (!candidate) {
            continue;
        }

        const upload = await ensureExternalBodyUpload({
            prepared,
            config,
            state,
            part,
            content: candidate.content,
            contentType: candidate.contentType,
        });

        prepared.payload.body[part] = {
            s3_url: upload.s3Url,
            size_bytes: upload.sizeBytes,
            content_type: upload.contentType,
            sha256: upload.sha256,
        };
        uploads.push({
            part,
            s3_key: upload.s3Key,
            s3_url: upload.s3Url,
            size_bytes: upload.sizeBytes,
            sha256: upload.sha256,
            reused: upload.reused,
        });
    }

    return uploads;
}

async function ensureExternalBodyUpload({ prepared, config, state, part, content, contentType }) {
    const entry = state.records[prepared.legacyEmailId];
    entry.bodyUploads ??= {};
    entry.bodyUploads[part] ??= {};
    const slot = entry.bodyUploads[part];
    const buffer = Buffer.from(content ?? '', 'utf8');
    const sizeBytes = buffer.length;
    const sha256 = sha256Hex(buffer);

    if (slot.s3Url && slot.sizeBytes === sizeBytes && slot.sha256 === sha256) {
        return {
            ...slot,
            reused: true,
        };
    }

    slot.fileName ||= `${part}-${randomUUID()}${part === 'html' ? '.html' : '.txt'}`;

    const response = await postJson(config, '/upload-s3-files', {
        url: 'email-bodies',
        id: prepared.payload.id,
        fileName: slot.fileName,
        contentType,
    });
    const uploadUrl = response?.data?.uploadUrl;
    if (!uploadUrl) {
        throw new Error(`Missing uploadUrl for ${part} email body.`);
    }

    await putPresignedObject(config, uploadUrl, buffer, contentType);

    const s3Url = canonicalS3Url(uploadUrl);
    const s3Key = s3KeyFromCanonicalUrl(s3Url);
    Object.assign(slot, {
        s3Key,
        s3Url,
        sizeBytes,
        contentType,
        sha256,
        uploadedAt: new Date().toISOString(),
    });

    return {
        ...slot,
        reused: false,
    };
}

function summarizeExternalBodyPlan(bodyPlan) {
    return ['text', 'html']
        .filter((part) => bodyPlan.external[part])
        .map((part) => {
            const content = bodyPlan.external[part].content;
            const buffer = Buffer.from(content ?? '', 'utf8');
            return {
                part,
                would_upload: true,
                size_bytes: buffer.length,
                sha256: sha256Hex(buffer),
            };
        });
}

function uploadedBodyObjectsFor(legacyEmailId, state) {
    const uploads = state.records?.[legacyEmailId]?.bodyUploads ?? {};
    return Object.entries(uploads)
        .filter(([, upload]) => upload?.s3Url)
        .map(([part, upload]) => ({
            part,
            s3_key: upload.s3Key,
            s3_url: upload.s3Url,
            size_bytes: upload.sizeBytes,
            sha256: upload.sha256,
        }));
}

async function postJson(config, apiPath, payload) {
    return await withRetries(config, async () => {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: config.authToken,
            'X-Tenant-Id': config.tenantId,
            'X-Client-Fingerprint': config.fingerprint,
        };

        if (config.cookie) {
            headers.Cookie = config.cookie;
        }

        const response = await fetch(buildUrl(config.apiUrl, apiPath), {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const bodyText = await response.text();
        const body = parseJsonSafely(bodyText);

        if (!response.ok) {
            throw new ApiError(`POST ${apiPath} failed with ${response.status}`, response.status, body ?? bodyText);
        }

        return body;
    });
}

async function putPresignedObject(config, uploadUrl, buffer, contentType) {
    return await withRetries(config, async () => {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
            },
            body: buffer,
        });

        const bodyText = await response.text();
        if (!response.ok) {
            throw new ApiError(`PUT S3 object failed with ${response.status}`, response.status, bodyText);
        }
    });
}

async function withRetries(config, operation) {
    let attempt = 0;
    let lastError;

    while (attempt <= config.maxRetries) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const status = error?.status;
            const retryable = !status || TRANSIENT_STATUSES.has(status);

            if (!retryable || attempt >= config.maxRetries) {
                throw error;
            }

            const delayMs = config.retryDelayMs * (attempt + 1);
            await sleep(delayMs);
            attempt += 1;
        }
    }

    throw lastError;
}

async function readRecords(filePath) {
    const raw = await readFile(filePath, 'utf8');
    const trimmed = raw.trim();

    if (!trimmed) {
        return [];
    }

    if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
            throw new Error('Input JSON must be an array or JSONL.');
        }
        return parsed;
    }

    return trimmed
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
            }
        });
}

async function readRecordFromStdin() {
    const raw = await readStdin();
    const trimmed = raw.trim();

    if (!trimmed) {
        throw new Error('stdin must contain one email record as JSON.');
    }

    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('stdin JSON must be one email record object.');
    }

    return parsed;
}

async function readStdin() {
    return await new Promise((resolve, reject) => {
        let raw = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            raw += chunk;
        });
        process.stdin.on('end', () => resolve(raw));
        process.stdin.on('error', reject);
    });
}

async function readState(filePath) {
    if (!existsSync(filePath)) {
        return { records: {} };
    }

    return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJsonFile(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runPool(items, concurrency, worker) {
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                await worker(items[index], index);
            }
        })
    );
}

function buildConfig(args) {
    const inputFile = args.input ?? process.env.KACE_INPUT_FILE ?? './legacy-emails.json';
    const resultFile = args.results ?? process.env.KACE_RESULT_FILE ?? './tmp/kace-email-api-migration-results.json';
    const stateFileExplicit = Boolean(args.state || process.env.KACE_STATE_FILE);

    return {
        apiUrl: stripTrailingSlash(args.apiUrl ?? process.env.KACE_API_URL ?? 'https://staging-api.kace-cloudtest.com'),
        tenantId: args.tenantId ?? process.env.KACE_TENANT_ID,
        authToken: args.token ?? process.env.KACE_AUTH_TOKEN,
        cookie: buildCookieHeader(
            args.cookie ?? process.env.KACE_COOKIE,
            args.sessionKey ?? process.env.KACE_SESSION_KEY
        ),
        fingerprint: args.fingerprint ?? process.env.KACE_FINGERPRINT ?? 'email-api-migration',
        inputFile,
        resultFile,
        stateFile: args.state ?? process.env.KACE_STATE_FILE ?? `${resultFile}.state.json`,
        stateFileExplicit,
        dryRun: booleanValue(args.dryRun ?? process.env.KACE_DRY_RUN, true),
        stdin: Boolean(args.stdin),
        concurrency: integerValue(args.concurrency ?? process.env.KACE_CONCURRENCY, 2),
        maxRetries: integerValue(args.retries ?? process.env.KACE_MAX_RETRIES, 3),
        retryDelayMs: integerValue(args.retryDelayMs ?? process.env.KACE_RETRY_DELAY_MS, 500),
        defaultWorkspaceId: args.workspaceId ?? process.env.KACE_WORKSPACE_ID,
        maxInlineHtmlBytes: integerValue(process.env.KACE_MAX_INLINE_HTML_BYTES, DEFAULT_HTML_MAX_BYTES),
        skipExistingSearch: booleanValue(process.env.KACE_SKIP_EXISTING_SEARCH, true),
        importAttachments: booleanValue(process.env.KACE_IMPORT_ATTACHMENTS, false),
        forceExternalBodies: booleanValue(process.env.KACE_FORCE_EXTERNAL_BODIES, false),
    };
}

function ensureRunnableConfig(config) {
    if (config.dryRun) {
        return;
    }

    const missing = [];
    if (!config.apiUrl) missing.push('KACE_API_URL');
    if (!config.tenantId) missing.push('KACE_TENANT_ID');
    if (!config.authToken) missing.push('KACE_AUTH_TOKEN');

    if (missing.length > 0) {
        throw new Error(`Missing required env/flags for import mode: ${missing.join(', ')}`);
    }
}

function parseArgs(argv) {
    const args = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') args.help = true;
        else if (arg === '--input') args.input = argv[++index];
        else if (arg === '--results') args.results = argv[++index];
        else if (arg === '--state') args.state = argv[++index];
        else if (arg === '--api-url') args.apiUrl = argv[++index];
        else if (arg === '--tenant-id') args.tenantId = argv[++index];
        else if (arg === '--token') args.token = argv[++index];
        else if (arg === '--cookie') args.cookie = argv[++index];
        else if (arg === '--session-key') args.sessionKey = argv[++index];
        else if (arg === '--fingerprint') args.fingerprint = argv[++index];
        else if (arg === '--workspace-id') args.workspaceId = argv[++index];
        else if (arg === '--concurrency') args.concurrency = argv[++index];
        else if (arg === '--retries') args.retries = argv[++index];
        else if (arg === '--retry-delay-ms') args.retryDelayMs = argv[++index];
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--no-dry-run') args.dryRun = false;
        else if (arg === '--stdin') args.stdin = true;
        else throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function summarize(results) {
    return results.reduce(
        (acc, result) => {
            acc.total += 1;
            if (result.status === 'created') acc.created += 1;
            else if (result.status === 'skipped_existing') acc.skipped_existing += 1;
            else if (result.status === 'dry_run') acc.dry_run += 1;
            else if (result.status === 'failed') acc.failed += 1;
            return acc;
        },
        { total: 0, created: 0, skipped_existing: 0, dry_run: 0, failed: 0 }
    );
}

function serializeError(error) {
    return {
        message: error?.message ?? String(error),
        status: error?.status,
        body: error?.body,
    };
}

function buildCookieHeader(cookie, sessionKey) {
    if (stringValue(cookie)) {
        return stringValue(cookie);
    }

    if (stringValue(sessionKey)) {
        return `session_key=${stringValue(sessionKey)}`;
    }

    return null;
}

function shouldPersistState(config) {
    return !config.dryRun && (!config.stdin || config.stateFileExplicit);
}

function toChildProcessResult(result) {
    return {
        status: result.status,
        legacy_email_id: result.legacy_email_id ?? null,
        email_id: result.email_id ?? null,
        message_id: result.message_id ?? null,
        warnings: result.warnings ?? [],
        external_body_uploads: result.external_body_uploads ?? [],
        ...(result.error ? { error: result.error } : {}),
    };
}

function writeStdoutJson(value) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}

function legacyIdFor(record, index) {
    const value =
        record?.legacy_email_id ??
        record?.legacyEmailId ??
        record?.source_email_id ??
        record?.sourceEmailId ??
        record?.legacy_id ??
        record?.id ??
        record?.message_id ??
        record?.messageId;

    return stringValue(value) || `row-${index + 1}`;
}

function assertUri(value, label) {
    try {
        const parsed = new URL(value);
        if (!parsed.protocol || !parsed.host) {
            throw new Error('missing protocol or host');
        }
    } catch (error) {
        throw new Error(`${label} must be an absolute URL: ${value}`);
    }
}

function defaultRecipientName(email) {
    return truncate(String(email).split('@')[0] || 'recipient', RECIPIENT_NAME_MAX_CHARS);
}

function toNonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return null;
    }

    return Math.max(0, Math.trunc(number));
}

function toIsoDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${value}`);
    }

    return date.toISOString();
}

function firstString(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined) {
            return String(value);
        }
    }
    return null;
}

function firstNonEmptyString(...values) {
    for (const value of values) {
        const normalized = stringValue(value);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function stringValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function emptyToNull(value) {
    return value ? value : null;
}

function truncate(value, maxLength) {
    if (value === null || value === undefined) {
        return value;
    }
    const text = String(value);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function stripHtmlToText(html) {
    return String(html ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
}

function byteLength(value) {
    return Buffer.byteLength(String(value), 'utf8');
}

function sha256Hex(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function canonicalS3Url(uploadUrl) {
    const url = new URL(uploadUrl);
    url.search = '';
    url.hash = '';
    return url.toString();
}

function s3KeyFromCanonicalUrl(s3Url) {
    return decodeURIComponent(new URL(s3Url).pathname.replace(/^\/+/, ''));
}

function validUuid(value) {
    const text = stringValue(value);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function booleanValue(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase());
}

function optionalBoolean(value, label) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'n'].includes(normalized)) {
        return false;
    }

    throw new Error(`${label} must be a boolean value.`);
}

function integerValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function stripTrailingSlash(value) {
    return String(value).replace(/\/+$/, '');
}

function buildUrl(apiUrl, apiPath) {
    return `${stripTrailingSlash(apiUrl)}/${String(apiPath).replace(/^\/+/, '')}`;
}

function parseJsonSafely(value) {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    } catch (_error) {
        return null;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage() {
    console.log(`
Usage:
  KACE_API_URL="https://staging-api.kace-cloudtest.com" \\
  KACE_TENANT_ID="tenant-id" \\
  KACE_AUTH_TOKEN="id-token-value" \\
  KACE_SESSION_KEY="session-cookie-value" \\
  KACE_INPUT_FILE="./legacy-emails.json" \\
  KACE_DRY_RUN=false \\
  node scripts/migrate-emails-via-kace-api.mjs

Flags:
  --input <path>
  --results <path>
  --state <path>
  --api-url <url>
  --tenant-id <id>
  --token <token>
  --cookie <cookie-header>
  --session-key <session_key-value>
  --workspace-id <uuid>
  --concurrency <n>
  --retries <n>
  --retry-delay-ms <ms>
  --dry-run
  --no-dry-run
  --stdin
`);
}

class ApiError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}
