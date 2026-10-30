import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexEmailsRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsRepository.js';
import { KnexEmailsBodyRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { KnexChannelHubAccountRepository } from '../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { KnexWorkspacesRepository } from '../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { KnexEmailAttachmentRepository } from '../../src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { ChannelHubInboundEmailProcessor } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js';
import { ChannelHubInboundTextBodyDownloader } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundTextBodyDownloader.js';
import {
    EXTERNAL_EMAIL_BODY_MAX_BYTES,
    INLINE_EMAIL_BODY_MAX_BYTES,
} from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailBodyContent.js';
import WorkspaceMother from '../workspaces/domain/WorkspaceMother.js';
import { ensureParentRow } from '../support/ensureParentRow.js';
import { globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';

jest.unstable_mockModule('dotenv', () => ({
    default: { config: jest.fn() },
}));

const allowedBodyUrl = 'https://channel-hub-cdn.example.com/messages/msg-1.txt';
const allowedHtmlBodyUrl = 'https://channel-hub-cdn.example.com/messages/msg-1.html';
const downloadedPlainText = 'Hello from the customer\nPlease help.';
const downloadedHtml = '<article><h1>Hello</h1><script>alert("stored-original")</script></article>';
const maxPlainTextBodyBytes = 1024 * 1024;
const attachmentUrl = 'https://channel-hub-cdn.example.com/attachments/invoice.pdf';
const durableAttachmentUrl = 'https://kace-bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf';
const longDurableAttachmentUrl = `https://kace-bucket.s3.amazonaws.com/attachments/email-id/${'a'.repeat(
    260
)}/invoice.pdf`;
// Unicos por test, reasignados en el beforeEach. Eran literales fijos y
// compartidos por los ~54 `it` del archivo, y eso hacia que cada test dependiera
// de que el reset entre tests hubiera limpiado de verdad: si sobrevivia una
// cuenta del test anterior con el mismo `connectionId`, `findByConnectionId`
// -que resuelve con un `.first()` SIN `ORDER BY`, o sea que la fila la elige el
// planificador- podia devolver la rancia, y con ella el email rancio, y el
// procesador salia por el corto-circuito de idempotencia sin descargar nada.
// Asi se puso roja la baseline del 13-08-2026. `tests/README.md` §3.5 ya
// prohibe depender de un `.first()` sobre una tabla que otro test puede tocar.
let defaultConnectionId;
let defaultWorkspaceTag;
let defaultMessageId;
const defaultInboxWorkspaceId = 'dbcc5b5a-61bb-4b5a-95d0-9f6222749e54';

function validPayload(overrides = {}) {
    const { workspaceTag = defaultWorkspaceTag, connectionId = defaultConnectionId, payload = {} } = overrides;

    return {
        messageId: defaultMessageId,
        origin: 'customer@example.com',
        subject: 'Need support',
        connectionId,
        tag: workspaceTag,
        destination: {
            to: [],
            cc: [],
            bcc: [{ email: 'SUPPORT@EXAMPLE.COM', name: 'Support' }],
        },
        content: {
            text: allowedBodyUrl,
        },
        received_at: '2026-05-14T10:00:00.000Z',
        ...payload,
    };
}

describe('ChannelHubInboundEmailProcessor', () => {
    const emailRepository = new KnexEmailsRepository(knexConfig);
    const emailBodyRepository = new KnexEmailsBodyRepository(emailRepository.connection);
    const emailAttachmentRepository = new KnexEmailAttachmentRepository(emailRepository.connection);
    const interactionRepository = new KnexInteractionRepository(emailRepository.connection);
    const channelHubAccountRepository = new KnexChannelHubAccountRepository(emailRepository.connection);
    const workspaceRepository = new KnexWorkspacesRepository(emailRepository.connection);
    const allowedConnectionRepository = {
        isAllowedConnection: jest.fn(),
    };
    const bodyDownloader = {
        download: jest.fn(),
    };
    const attachmentDownloader = {
        download: jest.fn(),
    };
    const attachmentStorage = {
        upload: jest.fn(),
        delete: jest.fn(),
    };
    const bodyStorage = {
        upload: jest.fn(),
        download: jest.fn(),
        delete: jest.fn(),
    };
    const fileScanner = {
        execute: jest.fn(),
    };
    const inlineImageEmbedder = {
        execute: jest.fn(async (html) => html),
    };

    beforeEach(async () => {
        const unico = uuidv4().slice(0, 8);
        defaultConnectionId = `conn_support_${unico}`;
        defaultWorkspaceTag = `test-tag-${unico}`;
        defaultMessageId = `channel-hub-external-message-id-that-is-not-a-uuid-${unico}`;

        allowedConnectionRepository.isAllowedConnection.mockResolvedValue(true);
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.from(downloadedPlainText, 'utf8'),
        });
        attachmentDownloader.download.mockResolvedValue({
            buffer: Buffer.from('invoice-file'),
            contentType: 'application/pdf',
            filename: 'downloaded-invoice.pdf',
            finalUrl: attachmentUrl,
        });
        attachmentStorage.upload.mockResolvedValue({
            s3Key: 'attachments/email-id/uuid_invoice.pdf',
            s3Url: durableAttachmentUrl,
        });
        attachmentStorage.delete.mockResolvedValue();
        bodyStorage.upload.mockResolvedValue({
            s3Key: 'email-bodies/email-id/text-body.txt',
            contentType: 'text/plain; charset=utf-8',
            sizeBytes: maxPlainTextBodyBytes + 1,
            sha256: 'a'.repeat(64),
        });
        bodyStorage.download.mockResolvedValue({
            content: downloadedPlainText,
            contentType: 'text/plain; charset=utf-8',
        });
        bodyStorage.delete.mockResolvedValue();
        fileScanner.execute.mockResolvedValue({ message: 'File validated successfully' });
        inlineImageEmbedder.execute.mockImplementation(async (html) => html);
    });

    afterEach(async () => {
        jest.clearAllMocks();
        // Los triggers que fuerzan un fallo de insercion son DDL propio del test.
        // Antes desaparecian de rebote porque el afterEach borraba la tabla entera;
        // sin aquel DROP, `resetTestDatabase` no los toca -no toca triggers ni
        // funciones, esta documentado en testDatabaseReset.js:337- y sobrevivirian
        // al resto de `it` del archivo.
        await emailRepository.connection.raw('DROP TRIGGER IF EXISTS force_email_body_failure ON emails_body');
        await emailRepository.connection.raw('DROP FUNCTION IF EXISTS force_email_body_failure()');
        await emailRepository.connection.raw('DROP TRIGGER IF EXISTS force_interaction_failure ON interactions');
        await emailRepository.connection.raw('DROP FUNCTION IF EXISTS force_interaction_failure()');
    });

    function createProcessor(overrides = {}) {
        return new ChannelHubInboundEmailProcessor({
            emailRepository,
            emailBodyRepository,
            emailAttachmentRepository,
            interactionRepository,
            channelHubAccountRepository,
            workspaceRepository,
            allowedConnectionRepository,
            bodyDownloader,
            attachmentDownloader,
            attachmentStorage,
            bodyStorage,
            fileScanner,
            inlineImageEmbedder,
            ...overrides,
        });
    }

    async function createChannelHubAccount(overrides = {}) {
        const now = new Date().toISOString();
        const account = {
            id: overrides.id ?? uuidv4(),
            email: overrides.email ?? 'support@example.com',
            name: overrides.name ?? 'Support',
            country_id: overrides.country_id ?? 'CO',
            operator_id: overrides.operator_id ?? 'imap',
            rest_flow_id: overrides.rest_flow_id ?? uuidv4(),
            channel_hub_connection_id: overrides.channel_hub_connection_id ?? defaultConnectionId,
            is_active: overrides.is_active ?? true,
            created_at: overrides.created_at ?? now,
            created_by: globalSystemUserId,
            updated_at: overrides.updated_at ?? now,
            updated_by: overrides.updated_by ?? globalSystemUserId,
            deleted_at: overrides.deleted_at ?? null,
            deleted_by: overrides.deleted_by ?? null,
            channel_hub_error: overrides.channel_hub_error ?? null,
            ...overrides,
        };

        // La tabla real tiene channel_hub_accounts_rest_flow_id_foreign -> ws_rest_flows(id),
        // que el DDL de juguete omitia: sin la fila padre el insert violaria la foranea.
        await ensureParentRow(emailRepository.connection, 'ws_rest_flows', account.rest_flow_id);

        await emailRepository.connection('channel_hub_accounts').insert(account);

        return {
            id: { value: account.id },
            email: { value: account.email },
        };
    }

    async function createWorkspaceWithChannelHubAccount(channelHubAccount, overrides = {}) {
        return WorkspaceMother.createWorkspace(workspaceRepository, {
            is_active: true,
            tag: defaultWorkspaceTag,
            channel_hub_accounts: [{ id: channelHubAccount.id.value }],
            created_by: globalSystemUserId,
            ...overrides,
        });
    }

    async function createDefaultInboxWorkspace(overrides = {}) {
        // La fila INBOX la siembra la migracion 20251209161718 y el reset por test
        // la repone, asi que aqui solo se ajusta lo que el caso necesite.
        await workspaceRepository
            .connection('workspaces')
            .where({ id: defaultInboxWorkspaceId })
            .update({ is_active: true, ...overrides });

        return { id: { value: defaultInboxWorkspaceId } };
    }

    async function createValidWorkspaceAndChannelHubAccount() {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);

        return { channelHubAccount, workspace };
    }

    async function tableCounts() {
        const [emails, bodies, attachments, interactions] = await Promise.all([
            emailRepository.connection('emails').count('* as count').first(),
            emailRepository.connection('emails_body').count('* as count').first(),
            emailRepository.connection('emails_attachments').count('* as count').first(),
            emailRepository.connection('interactions').count('* as count').first(),
        ]);

        return {
            emails: Number(emails.count),
            bodies: Number(bodies.count),
            attachments: Number(attachments.count),
            interactions: Number(interactions.count),
        };
    }

    /**
     * Crea un trigger BEFORE INSERT que aborta la transaccion, ejecuta `fn` y lo
     * retira pase lo que pase. El `finally` es la red: si el `it` falla antes de
     * llegar al afterEach, el trigger ya se ha ido.
     *
     * @param {string} table - Tabla sobre la que colgar el trigger.
     * @param {string} name - Nombre del trigger y de su funcion.
     * @param {string} message - Texto del error que lanza.
     * @param {() => Promise<void>} fn - Lo que se ejecuta con el trigger puesto.
     */
    async function withFailingInsertTrigger(table, name, message, fn) {
        const connection = emailRepository.connection;

        await connection.raw(`
            CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION '${message}';
            END;
            $$ LANGUAGE plpgsql;
        `);
        await connection.raw(`
            CREATE OR REPLACE TRIGGER ${name}
                BEFORE INSERT ON ${table}
                FOR EACH ROW EXECUTE FUNCTION ${name}();
        `);

        try {
            await fn();
        } finally {
            await connection.raw(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
            await connection.raw(`DROP FUNCTION IF EXISTS ${name}()`);
        }
    }

    /**
     * Ejecuta `fn` con el guardian de SQL en modo `enforce` y restaura despues el
     * valor previo, como ya hacen SQLInjectionGuardMode.test.js y
     * ValueObjectSqlGuardObserve.test.js. Hace falta porque el `.env` de la raiz
     * -que jest.config.js carga- fija SQL_GUARD_MODE=observe para toda la suite,
     * y en ese modo SQLInjectionGuard registra pero no lanza.
     *
     * @param {() => Promise<void>} fn - Lo que se ejecuta con el modo fijado.
     */
    async function withSqlGuardEnforced(fn) {
        const original = process.env.SQL_GUARD_MODE;
        process.env.SQL_GUARD_MODE = 'enforce';

        try {
            await fn();
        } finally {
            if (original === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = original;
            }
        }
    }

    async function expectNoRecordsCreated() {
        await expect(tableCounts()).resolves.toEqual({
            emails: 0,
            bodies: 0,
            attachments: 0,
            interactions: 0,
        });
    }

    async function expectWorkspaceHasNoChannelHubAccounts(workspaceId) {
        const rows = await emailRepository
            .connection('workspaces_channel_hub_accounts_relations')
            .where({ workspace_id: workspaceId })
            .select('*');

        expect(rows).toHaveLength(0);
    }

    function jsonField(value) {
        return typeof value === 'string' ? JSON.parse(value) : value;
    }

    it('accepts a BCC-only inbound email and atomically creates Email, EmailBody, and linked Interaction', async () => {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(result.status).toBe('accepted');
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedBodyUrl);
        expect(bodyDownloader.download).toHaveBeenCalledWith(allowedBodyUrl);

        const emails = await emailRepository.connection('emails').select('*');
        const emailBodies = await emailRepository.connection('emails_body').select('*');
        const interactions = await emailRepository.connection('interactions').select('*');

        expect(emails).toHaveLength(1);
        expect(emailBodies).toHaveLength(1);
        expect(interactions).toHaveLength(1);

        const [email] = emails;
        const [emailBody] = emailBodies;
        const [interaction] = interactions;

        expect(email.sender).toBe('customer@example.com');
        expect(jsonField(email.to)).toEqual([{ email: 'support@example.com', name: 'Support' }]);
        expect(jsonField(email.cc)).toEqual([]);
        expect(jsonField(email.bcc)).toEqual([{ email: 'support@example.com', name: 'Support' }]);
        expect(email.workspace_id).toBe(workspace.id.value);
        expect(email.account_id).toBe(channelHubAccount.id.value);
        expect(email.message_id).toBe(payload.messageId);
        expect(new Date(email.received_at).toISOString()).toBe(payload.received_at);
        expect(email.created_by).toBe(globalSystemUserId);
        expect(email.updated_by).toBe(globalSystemUserId);

        expect(emailBody.email_id).toBe(email.id);
        expect(emailBody.body).toBe(downloadedPlainText);
        expect(emailBody.body).not.toBe(allowedBodyUrl);
        expect(emailBody.created_by).toBe(globalSystemUserId);
        expect(emailBody.updated_by).toBe(globalSystemUserId);

        expect(interaction.email_id).toBe(email.id);
        expect(interaction.channel_id).toBe('email');
        expect(interaction.client_identifier).toBe('customer@example.com');
        expect(interaction.external_identifier).toBe(payload.messageId);
        expect(interaction.description).toBe(payload.subject);
        expect(interaction.conversation_id).toBe(payload.messageId);
        expect(interaction.priority).toBe('normal');
        expect(interaction.workspace_id).toBe(workspace.id.value);
        expect(new Date(interaction.receipt_at).toISOString()).toBe(payload.received_at);
        expect(interaction.created_by).toBe(globalSystemUserId);
    });

    it('copies the BCC-only Channel Hub recipient into TO while retaining BCC for persistence', async () => {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                destination: {
                    to: '',
                    cc: '',
                    bcc: 'SUPPORT@EXAMPLE.COM',
                },
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(jsonField(email.to)).toEqual([{ email: 'support@example.com', name: null }]);
        expect(jsonField(email.cc)).toEqual([]);
        expect(jsonField(email.bcc)).toEqual([{ email: 'support@example.com', name: null }]);
        expect(email.account_id).toBe(channelHubAccount.id.value);
        expect(email.workspace_id).toBe(workspace.id.value);
    });

    it('does not expose multiple BCC recipients by promoting them into TO', async () => {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                destination: {
                    to: '',
                    cc: '',
                    bcc: ['SUPPORT@EXAMPLE.COM', 'private@example.com'],
                },
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(jsonField(email.to)).toEqual([]);
        expect(jsonField(email.bcc)).toEqual([
            { email: 'support@example.com', name: null },
            { email: 'private@example.com', name: null },
        ]);
    });

    it('persists operatorDate as received_at when provided', async () => {
        const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const operatorDate = '2026-06-09T10:00:00.000Z';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { operatorDate, received_at: undefined },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(new Date(email.received_at).toISOString()).toBe(operatorDate);
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(new Date(interaction.receipt_at).toISOString()).toBe(operatorDate);
    });

    it('prefers operatorDate over received_at when both are valid', async () => {
        const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const operatorDate = '2026-06-09T10:00:00.000Z';
        const receivedAt = '2026-05-14T10:00:00.000Z';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { operatorDate, received_at: receivedAt },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(new Date(email.received_at).toISOString()).toBe(operatorDate);
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(new Date(interaction.receipt_at).toISOString()).toBe(operatorDate);
    });

    it('falls back to received_at when operatorDate is an empty string', async () => {
        const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const receivedAt = '2026-05-14T10:00:00.000Z';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { operatorDate: '', received_at: receivedAt },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(new Date(email.received_at).toISOString()).toBe(receivedAt);
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(new Date(interaction.receipt_at).toISOString()).toBe(receivedAt);
    });

    it('falls back to received_at when operatorDate is null', async () => {
        const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const receivedAt = '2026-05-14T10:00:00.000Z';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { operatorDate: null, received_at: receivedAt },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(new Date(email.received_at).toISOString()).toBe(receivedAt);
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(new Date(interaction.receipt_at).toISOString()).toBe(receivedAt);
    });

    it('splits comma-separated string recipients for persistence without affecting connectionId routing', async () => {
        const channelHubAccount = await createChannelHubAccount({ email: 'juan.zapata@konecta.com' });
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                destination: {
                    to: 'JUAN.ZAPATA@KONECTA.COM, soporte@konecta.com',
                    cc: 'juanfernet007@gmail.com, juanfernet007@hotmail.com, juanfernet007@yahoo.es',
                    bcc: '',
                },
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(jsonField(email.to)).toEqual([
            { email: 'juan.zapata@konecta.com', name: null },
            { email: 'soporte@konecta.com', name: null },
        ]);
        expect(jsonField(email.cc)).toEqual([
            { email: 'juanfernet007@gmail.com', name: null },
            { email: 'juanfernet007@hotmail.com', name: null },
            { email: 'juanfernet007@yahoo.es', name: null },
        ]);
        expect(jsonField(email.bcc)).toEqual([]);
        expect(email.account_id).toBe(channelHubAccount.id.value);
    });

    it('routes by connectionId when another Channel Hub Account has the same recipient email', async () => {
        const assignedAccount = await createChannelHubAccount({ email: 'support@example.com' });
        await createChannelHubAccount({
            email: 'support@example.com',
            channel_hub_connection_id: 'conn_same_recipient_email',
        });
        const workspace = await createWorkspaceWithChannelHubAccount(assignedAccount);
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.account_id).toBe(assignedAccount.id.value);
    });

    it('downloads trusted Channel Hub HTML body and stores original HTML separately from plain text', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: allowedHtmlBodyUrl,
                },
            },
        });
        bodyDownloader.download.mockImplementation(async (url) => ({
            buffer: Buffer.from(url === allowedHtmlBodyUrl ? downloadedHtml : downloadedPlainText, 'utf8'),
            finalUrl: url,
        }));

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedHtmlBodyUrl);
        expect(bodyDownloader.download).toHaveBeenCalledWith(allowedBodyUrl);
        expect(bodyDownloader.download).toHaveBeenCalledWith(allowedHtmlBodyUrl, { kind: 'html' });

        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body).toBe(downloadedPlainText);
        expect(emailBody.body_html).toBe(downloadedHtml);
        expect(emailBody.body_html).not.toBe(allowedHtmlBodyUrl);
    });

    it('passes downloaded HTML body through inline image embedder and stores the rewritten HTML', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const htmlWithInlineImage =
            '<article><img src="https://channel-hub-cdn.example.com/images/logo.png"></article>';
        const rewrittenHtml = '<article><img src="data:image/png;base64,aW1hZ2U="></article>';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: allowedHtmlBodyUrl,
                },
            },
        });
        bodyDownloader.download.mockImplementation(async (url) => ({
            buffer: Buffer.from(url === allowedHtmlBodyUrl ? htmlWithInlineImage : downloadedPlainText, 'utf8'),
            finalUrl: url,
        }));
        inlineImageEmbedder.execute.mockResolvedValueOnce(rewrittenHtml);

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(inlineImageEmbedder.execute).toHaveBeenCalledWith(htmlWithInlineImage);

        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html).toBe(rewrittenHtml);
    });

    it('downloads trusted Channel Hub attachments, uploads to KACE S3, scans, and persists durable filename records', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [
                    {
                        url: attachmentUrl,
                        filename: 'invoice.pdf',
                        content_type: 'application/pdf',
                        size: 12,
                    },
                ],
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(attachmentUrl);
        expect(attachmentDownloader.download).toHaveBeenCalledWith(attachmentUrl);
        expect(attachmentStorage.upload).toHaveBeenCalledWith(
            expect.objectContaining({
                buffer: Buffer.from('invoice-file'),
                contentType: 'application/pdf',
                filename: 'invoice.pdf',
            })
        );
        expect(fileScanner.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'attachments',
                id: expect.any(String),
                fileName: expect.stringContaining('invoice.pdf'),
            })
        );

        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.url).toBe(durableAttachmentUrl);
        expect(attachment.url).not.toBe(attachmentUrl);
        expect(attachment.size).toBe(12);
        expect(attachment.filename).toBe('invoice.pdf');
    });

    it('downloads trusted Channel Hub attachments when payload entries are URL strings', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [attachmentUrl],
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(attachmentUrl);
        expect(attachmentDownloader.download).toHaveBeenCalledWith(attachmentUrl);
        expect(attachmentStorage.upload).toHaveBeenCalledWith(
            expect.objectContaining({
                buffer: Buffer.from('invoice-file'),
                contentType: 'application/pdf',
                filename: 'downloaded-invoice.pdf',
            })
        );

        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.url).toBe(durableAttachmentUrl);
        expect(attachment.filename).toBe('downloaded-invoice.pdf');
        expect(Number(attachment.size)).toBe(Buffer.from('invoice-file').length);
    });

    it('persists durable attachment URLs longer than the legacy 255 character limit', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        attachmentStorage.upload.mockResolvedValue({
            s3Key: 'attachments/email-id/uuid_invoice.pdf',
            s3Url: longDurableAttachmentUrl,
        });
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [attachmentUrl],
            },
        });

        const result = await createProcessor().execute(payload);

        expect(longDurableAttachmentUrl.length).toBeGreaterThan(255);
        expect(result.accepted).toBe(true);
        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.url).toBe(longDurableAttachmentUrl);
    });

    it('canonicalizes unsafe attachment filenames before upload, persistence, and scan', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        attachmentStorage.upload.mockImplementation(async ({ filename }) => ({
            s3Key: `attachments/email-id/uuid_${filename}`,
            s3Url: durableAttachmentUrl,
        }));
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [
                    {
                        url: attachmentUrl,
                        filename: '../../evil.pdf',
                    },
                ],
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(attachmentStorage.upload).toHaveBeenCalledWith(expect.objectContaining({ filename: 'evil.pdf' }));
        expect(fileScanner.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: expect.stringContaining('evil.pdf'),
            })
        );
        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.filename).toBe('evil.pdf');
    });

    it('returns non-retryable and creates no records when an attachment URL is untrusted before downloads', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== attachmentUrl);

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_attachment_url');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        expect(attachmentDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it.each([
        ['download failure', () => attachmentDownloader.download.mockRejectedValue(new Error('download failed'))],
        ['upload failure', () => attachmentStorage.upload.mockRejectedValue(new Error('upload failed'))],
        [
            'scanner rejection',
            () =>
                fileScanner.execute.mockResolvedValue({
                    message: 'Threat detected',
                    errors: { fileName: 'invoice.pdf' },
                }),
        ],
    ])('returns retryable and leaves no records when attachment %s occurs', async (_name, arrange) => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        arrange();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });

        const result = await createProcessor().execute(payload);

        expect(result.retryable).toBe(true);
        expect(result.code).toBe('processing_failed');
        await expectNoRecordsCreated();
    });

    it('deletes uploaded attachment storage when scanner rejects the file', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        fileScanner.execute.mockResolvedValue({
            message: 'Threat detected',
            errors: { fileName: 'invoice.pdf' },
        });
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });

        const result = await createProcessor().execute(payload);

        expect(result.retryable).toBe(true);
        expect(attachmentStorage.delete).toHaveBeenCalledWith('attachments/email-id/uuid_invoice.pdf');
        await expectNoRecordsCreated();
    });

    it('returns non-retryable attachment_encrypted with the original PDF filename', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const filename = '08FalloTutela2026-0925-ConcedePeticion.pdf';
        fileScanner.execute.mockResolvedValue({
            code: 'attachment_encrypted',
            message: 'Attachment cannot be scanned: encrypted PDF',
            errors: { fileName: `uuid_${filename}` },
        });
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename }] },
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('attachment_encrypted');
        expect(result.message).toBe(`Attachment cannot be scanned: encrypted PDF '${filename}'`);
        expect(attachmentStorage.delete).toHaveBeenCalledWith('attachments/email-id/uuid_invoice.pdf');
        await expectNoRecordsCreated();
    });

    it('deletes uploaded attachment storage when scanner throws', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        fileScanner.execute.mockRejectedValue(new Error('scanner unavailable'));
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });

        const result = await createProcessor().execute(payload);

        expect(result.retryable).toBe(true);
        expect(attachmentStorage.delete).toHaveBeenCalledWith('attachments/email-id/uuid_invoice.pdf');
        await expectNoRecordsCreated();
    });

    it('deletes previously uploaded attachment storage when a later attachment fails', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const firstKey = 'attachments/email-id/first_invoice.pdf';
        attachmentStorage.upload
            .mockResolvedValueOnce({
                s3Key: firstKey,
                s3Url: durableAttachmentUrl,
            })
            .mockRejectedValueOnce(new Error('second upload failed'));
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [
                    { url: attachmentUrl, filename: 'invoice.pdf' },
                    {
                        url: 'https://channel-hub-cdn.example.com/attachments/receipt.pdf',
                        filename: 'receipt.pdf',
                    },
                ],
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.retryable).toBe(true);
        expect(attachmentStorage.delete).toHaveBeenCalledWith(firstKey);
        await expectNoRecordsCreated();
    });

    it('returns already processed for duplicate replay before validating changed attachment URLs', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const firstPayload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }],
            },
        });
        const evilAttachmentUrl = 'https://evil.example.com/attachments/invoice.pdf';
        const replayPayload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                attachments: [{ url: evilAttachmentUrl, filename: 'invoice.pdf' }],
            },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== evilAttachmentUrl);

        const first = await createProcessor().execute(firstPayload);
        const replay = await createProcessor().execute(replayPayload);

        expect(first.accepted).toBe(true);
        expect(replay.accepted).toBe(true);
        expect(replay.alreadyProcessed).toBe(true);
        expect(replay.code).toBe('already_processed');
        expect(attachmentDownloader.download).toHaveBeenCalledTimes(1);
        expect(allowedConnectionRepository.isAllowedConnection).not.toHaveBeenCalledWith(evilAttachmentUrl);
    });

    it('returns non-retryable and creates no records when the HTML body URL is untrusted', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: allowedHtmlBodyUrl,
                },
            },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== allowedHtmlBodyUrl);

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_html_body_url');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable and creates no records when the downloaded HTML body final URL is untrusted', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const htmlRedirectedUrl = 'https://evil.example.com/messages/msg-1.html';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: allowedHtmlBodyUrl,
                },
            },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== htmlRedirectedUrl);
        bodyDownloader.download.mockImplementation(async (url) => ({
            buffer: Buffer.from(url === allowedHtmlBodyUrl ? downloadedHtml : downloadedPlainText, 'utf8'),
            finalUrl: url === allowedHtmlBodyUrl ? htmlRedirectedUrl : url,
        }));

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_html_body_url');
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedHtmlBodyUrl);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(htmlRedirectedUrl);
        await expectNoRecordsCreated();
    });

    it('returns already processed for duplicate replay before validating changed HTML body URLs', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const firstPayload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: allowedHtmlBodyUrl,
                },
            },
        });
        const evilHtmlUrl = 'https://evil.example.com/messages/msg-1.html';
        const replayPayload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                content: {
                    text: allowedBodyUrl,
                    html: evilHtmlUrl,
                },
            },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== evilHtmlUrl);
        bodyDownloader.download.mockImplementation(async (url) => ({
            buffer: Buffer.from(url === allowedHtmlBodyUrl ? downloadedHtml : downloadedPlainText, 'utf8'),
            finalUrl: url,
        }));

        const first = await createProcessor().execute(firstPayload);
        const replay = await createProcessor().execute(replayPayload);

        expect(first.accepted).toBe(true);
        expect(replay.accepted).toBe(true);
        expect(replay.alreadyProcessed).toBe(true);
        expect(replay.code).toBe('already_processed');
        expect(bodyDownloader.download).toHaveBeenCalledTimes(2);
        expect(allowedConnectionRepository.isAllowedConnection).not.toHaveBeenCalledWith(evilHtmlUrl);
    });

    it('returns an already-processed success and creates no duplicate records for a repeated External Message ID', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const first = await createProcessor().execute(payload);
        const second = await createProcessor().execute(payload);

        expect(first.accepted).toBe(true);
        expect(second.accepted).toBe(true);
        expect(second.alreadyProcessed).toBe(true);
        expect(second.code).toBe('already_processed');
        expect(second.data).toEqual({
            already_processed: true,
            email_id: first.data.email_id,
            interaction_id: first.data.interaction_id,
        });
        await expect(tableCounts()).resolves.toEqual({
            emails: 1,
            bodies: 1,
            attachments: 0,
            interactions: 1,
        });
        expect(bodyDownloader.download).toHaveBeenCalledTimes(1);
    });

    it('treats a soft-deleted Email idempotency row as already processed without downloading again', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const first = await createProcessor().execute(payload);
        await emailRepository
            .connection('emails')
            .where({ id: first.data.email_id })
            .update({ deleted_at: '2026-05-14T11:00:00.000Z' });

        const second = await createProcessor().execute(payload);

        expect(second.accepted).toBe(true);
        expect(second.alreadyProcessed).toBe(true);
        expect(second.data.email_id).toBe(first.data.email_id);
        await expect(tableCounts()).resolves.toEqual({
            emails: 1,
            bodies: 1,
            attachments: 0,
            interactions: 1,
        });
        expect(bodyDownloader.download).toHaveBeenCalledTimes(1);
    });

    it('recovers a duplicate race when the pre-check misses but the unique insert loses the race', async () => {
        const duplicateEmailId = uuidv4();
        const duplicateInteractionId = uuidv4();
        const uniqueViolation = new Error(
            'SQLITE_CONSTRAINT: UNIQUE constraint failed: emails.workspace_id, emails.message_id'
        );
        const connection = {
            transaction: jest.fn().mockRejectedValue(uniqueViolation),
        };
        const fakeEmailRepository = {
            tableName: 'emails',
            connection,
            findByWorkspaceAndMessageId: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: { value: duplicateEmailId } }),
        };
        const fakeProcessor = new ChannelHubInboundEmailProcessor({
            emailRepository: fakeEmailRepository,
            emailBodyRepository: { tableName: 'emails_body' },
            emailAttachmentRepository: { tableName: 'emails_attachments' },
            interactionRepository: {
                tableName: 'interactions',
                findByEmailId: jest.fn().mockResolvedValue({ id: { value: duplicateInteractionId } }),
            },
            channelHubAccountRepository: {
                findByConnectionId: jest.fn().mockResolvedValue({
                    id: { value: uuidv4() },
                    email: { value: 'support@example.com' },
                    channel_hub_connection_id: { value: defaultConnectionId },
                }),
            },
            workspaceRepository: {
                findActiveByChannelHubAccountIdAndTag: jest.fn().mockResolvedValue([{ id: { value: uuidv4() } }]),
                findDefaultInboxWorkspace: jest.fn(),
            },
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            bodyDownloader: {
                download: jest.fn().mockResolvedValue({ buffer: Buffer.from(downloadedPlainText, 'utf8') }),
            },
            attachmentDownloader: { download: jest.fn() },
            attachmentStorage: { upload: jest.fn() },
            fileScanner: { execute: jest.fn() },
        });

        const result = await fakeProcessor.execute(validPayload({ workspaceTag: 'test-tag' }));

        expect(result.accepted).toBe(true);
        expect(result.alreadyProcessed).toBe(true);
        expect(result.data).toEqual({
            already_processed: true,
            email_id: duplicateEmailId,
            interaction_id: duplicateInteractionId,
        });
        expect(fakeEmailRepository.findByWorkspaceAndMessageId).toHaveBeenCalledTimes(2);
    });

    it('uses schema-aware repository helpers for Channel Hub transactional inserts', async () => {
        const workspaceId = uuidv4();
        const channelHubAccountId = uuidv4();
        const rawTrx = jest.fn((tableName) => {
            throw new Error(`Unqualified transaction table used: ${tableName}`);
        });
        const insertedTables = [];
        const connection = {
            transaction: jest.fn(async (callback) => callback(rawTrx)),
        };
        const makeRepository = (tableName, extra = {}) => {
            const insert = jest.fn(async () => {
                insertedTables.push(tableName);
            });

            return {
                tableName,
                trxTable: jest.fn(() => ({ insert })),
                insert,
                ...extra,
            };
        };

        const fakeEmailRepository = makeRepository('emails', {
            connection,
            findByWorkspaceAndMessageId: jest.fn().mockResolvedValue(null),
        });
        const fakeEmailBodyRepository = makeRepository('emails_body');
        const fakeEmailAttachmentRepository = makeRepository('emails_attachments');
        const fakeInteractionRepository = makeRepository('interactions');
        const fakeProcessor = new ChannelHubInboundEmailProcessor({
            emailRepository: fakeEmailRepository,
            emailBodyRepository: fakeEmailBodyRepository,
            emailAttachmentRepository: fakeEmailAttachmentRepository,
            interactionRepository: fakeInteractionRepository,
            channelHubAccountRepository: {
                findByConnectionId: jest.fn().mockResolvedValue({
                    id: { value: channelHubAccountId },
                    email: { value: 'support@example.com' },
                    channel_hub_connection_id: { value: defaultConnectionId },
                }),
            },
            workspaceRepository: {
                findActiveByChannelHubAccountIdAndTag: jest.fn().mockResolvedValue([{ id: { value: workspaceId } }]),
                findDefaultInboxWorkspace: jest.fn(),
            },
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            bodyDownloader: {
                download: jest.fn().mockResolvedValue({ buffer: Buffer.from(downloadedPlainText, 'utf8') }),
            },
            attachmentDownloader: {
                download: jest.fn().mockResolvedValue({
                    buffer: Buffer.from('invoice-file'),
                    contentType: 'application/pdf',
                    filename: 'downloaded-invoice.pdf',
                    finalUrl: attachmentUrl,
                }),
            },
            attachmentStorage: {
                upload: jest.fn().mockResolvedValue({
                    s3Key: 'attachments/email-id/uuid_invoice.pdf',
                    s3Url: durableAttachmentUrl,
                }),
                delete: jest.fn(),
            },
            bodyStorage: { upload: jest.fn(), delete: jest.fn() },
            fileScanner: { execute: jest.fn().mockResolvedValue({ message: 'File validated successfully' }) },
            inlineImageEmbedder: { execute: jest.fn(async (html) => html) },
        });

        const result = await fakeProcessor.execute(
            validPayload({
                workspaceTag: 'test-tag',
                payload: {
                    attachments: [{ url: attachmentUrl, filename: 'invoice.pdf', size: 12 }],
                },
            })
        );

        expect(result.accepted).toBe(true);
        expect(connection.transaction).toHaveBeenCalledTimes(1);
        expect(rawTrx).not.toHaveBeenCalled();
        expect(insertedTables).toEqual(['emails', 'emails_body', 'emails_attachments', 'interactions']);
        expect(fakeEmailRepository.trxTable).toHaveBeenCalledWith(rawTrx);
        expect(fakeEmailBodyRepository.trxTable).toHaveBeenCalledWith(rawTrx);
        expect(fakeEmailAttachmentRepository.trxTable).toHaveBeenCalledWith(rawTrx);
        expect(fakeInteractionRepository.trxTable).toHaveBeenCalledWith(rawTrx);
    });

    it('uses Channel Hub messageId as external identity even when messageIdOperator is present', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                messageId: 'provider-message-id',
                messageIdOperator: 'operator-message-id',
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.message_id).toBe('provider-message-id');
        expect(interaction.external_identifier).toBe('provider-message-id');
        expect(interaction.conversation_id).toBe('provider-message-id');
    });

    it('stores Channel Hub threadId on Email without changing message identity or conversation grouping', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                messageId: 'provider-message-id',
                messageIdOperator: 'operator-message-id',
                threadId: 'operator-thread-id',
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.message_id).toBe('provider-message-id');
        expect(email.thread_id).toBe('operator-thread-id');
        expect(interaction.external_identifier).toBe('provider-message-id');
        expect(interaction.conversation_id).toBe('provider-message-id');
    });

    it('enforces one Email per workspace and External Message ID and one Interaction per Email', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const result = await createProcessor().execute(payload);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');

        expect(result.accepted).toBe(true);
        await expect(
            emailRepository.connection('emails').insert({
                ...email,
                // pg devuelve las columnas jsonb ya parseadas a arrays de JS, y
                // reinsertarlas tal cual haria que el driver las mandara como
                // array de postgres: la fila reventaria por sintaxis json antes
                // de llegar al indice unico que este test comprueba.
                to: JSON.stringify(email.to),
                cc: JSON.stringify(email.cc),
                bcc: JSON.stringify(email.bcc),
                id: uuidv4(),
                s3_key: 'channel-hub/inbound/duplicate',
            })
        ).rejects.toThrow(/unique|constraint/i);
        await expect(
            emailRepository.connection('interactions').insert({
                ...interaction,
                id: uuidv4(),
            })
        ).rejects.toThrow(/unique|constraint/i);
    });

    it('accepts a minimal BCC inbound email without subject using a safe subject and description default', async () => {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { subject: undefined },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);

        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');

        expect(email.subject).toBe('No subject');
        expect(interaction.description).toBe('No subject');
    });

    it('accepts a valid email subject with common punctuation as Email subject and Interaction description', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const subject = 'Re: Ticket #123 / Support';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { subject },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.subject).toBe(subject);
        expect(interaction.description).toBe(subject);
    });

    it('uses tag to select the Workspace among workspaces assigned to the connectionId account', async () => {
        const channelHubAccount = await createChannelHubAccount();
        await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'Other Tag Workspace',
            tag: 'other-tag',
        });
        const selectedWorkspace = await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'Selected Tag Workspace',
            tag: 'target-tag',
        });
        const payload = validPayload({ workspaceTag: 'target-tag' });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.account_id).toBe(channelHubAccount.id.value);
        expect(email.workspace_id).toBe(selectedWorkspace.id.value);
        expect(interaction.workspace_id).toBe(selectedWorkspace.id.value);
    });

    it('routes the same connectionId account to different Workspaces according to the matched tag', async () => {
        const channelHubAccount = await createChannelHubAccount({
            email: 'farangot@konecta.com',
            channel_hub_connection_id: 'conn_farango',
        });
        const juanfersWorkspace = await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'workspaceJuanfers',
            tag: 'juanfer',
        });
        const luiguiWorkspace = await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'workspaceLuigui',
            tag: 'nintendo',
        });

        const juanferResult = await createProcessor().execute(
            validPayload({
                connectionId: 'conn_farango',
                workspaceTag: 'juanfer',
                payload: { messageId: 'message-for-juanfer' },
            })
        );
        const nintendoResult = await createProcessor().execute(
            validPayload({
                connectionId: 'conn_farango',
                workspaceTag: 'nintendo',
                payload: { messageId: 'message-for-nintendo' },
            })
        );

        expect(juanferResult.accepted).toBe(true);
        expect(nintendoResult.accepted).toBe(true);
        const emails = await emailRepository.connection('emails').select('*').orderBy('message_id');
        const interactions = await emailRepository
            .connection('interactions')
            .select('*')
            .orderBy('external_identifier');
        expect(emails.map((email) => [email.message_id, email.workspace_id])).toEqual([
            ['message-for-juanfer', juanfersWorkspace.id.value],
            ['message-for-nintendo', luiguiWorkspace.id.value],
        ]);
        expect(interactions.map((interaction) => [interaction.external_identifier, interaction.workspace_id])).toEqual([
            ['message-for-juanfer', juanfersWorkspace.id.value],
            ['message-for-nintendo', luiguiWorkspace.id.value],
        ]);
    });

    it('returns non-retryable and creates no records when connectionId is missing', async () => {
        await createChannelHubAccount();
        const payload = validPayload({ payload: { connectionId: undefined } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.retryable).toBe(false);
        expect(result.code).toBe('missing_channel_hub_connection_id');
        expect(result.message).toBe('Channel Hub connectionId is required.');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it.each([
        ['missing', undefined],
        ['blank', ''],
        ['null', null],
    ])(
        'falls back to INBOX without a Channel Hub account assignment when tag is %s for a known connectionId',
        async (_name, tag) => {
            const channelHubAccount = await createChannelHubAccount({
                email: 'farangot@konecta.com',
                channel_hub_connection_id: 'conn_farango',
            });
            await createWorkspaceWithChannelHubAccount(channelHubAccount, {
                description: 'workspaceJuanfers',
                tag: 'juanfer',
            });
            const inbox = await createDefaultInboxWorkspace();
            const payload =
                tag === undefined
                    ? validPayload({ connectionId: 'conn_farango', payload: { tag: undefined, tags: uuidv4() } })
                    : validPayload({ connectionId: 'conn_farango', payload: { tag } });

            const result = await createProcessor().execute(payload);

            expect(result.accepted).toBe(true);
            const [email] = await emailRepository.connection('emails').select('*');
            const [interaction] = await emailRepository.connection('interactions').select('*');
            expect(email.account_id).toBe(channelHubAccount.id.value);
            expect(email.workspace_id).toBe(inbox.id.value);
            expect(interaction.workspace_id).toBe(inbox.id.value);
            await expectWorkspaceHasNoChannelHubAccounts(inbox.id.value);
        }
    );

    it('returns non-retryable and creates no records when connectionId is unknown', async () => {
        await createChannelHubAccount({ channel_hub_connection_id: 'known_conn' });
        const payload = validPayload({ connectionId: 'unknown_conn' });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.retryable).toBe(false);
        expect(result.code).toBe('channel_hub_connection_not_found');
        expect(result.message).toBe(
            "Channel Hub connectionId 'unknown_conn' does not match a configured Channel Hub Account in KACE."
        );
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('does not fall back to INBOX when connectionId is unknown even if tag is missing', async () => {
        await createChannelHubAccount({ channel_hub_connection_id: 'known_conn' });
        await createDefaultInboxWorkspace();
        const payload = validPayload({ connectionId: 'unknown_conn', payload: { tag: undefined } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.retryable).toBe(false);
        expect(result.code).toBe('channel_hub_connection_not_found');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable when INBOX is missing and no tag fallback is required', async () => {
        // La fila INBOX viene sembrada por la migracion y el reset la repone, asi que
        // el escenario "no configurada" hay que provocarlo borrandola. No tiene hijas
        // en este punto: emails e interactions estan vacias en la plantilla.
        await emailRepository.connection('workspaces').where({ id: defaultInboxWorkspaceId }).del();
        await createChannelHubAccount({ channel_hub_connection_id: 'conn_no_tag' });
        const payload = validPayload({ connectionId: 'conn_no_tag', payload: { tag: undefined } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.retryable).toBe(false);
        expect(result.code).toBe('default_inbox_workspace_not_found');
        expect(result.message).toBe('Default INBOX Workspace is not configured or inactive.');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('falls back to INBOX without a Channel Hub account assignment when the known connectionId account has no workspace matching the tag', async () => {
        const channelHubAccount = await createChannelHubAccount();
        await createWorkspaceWithChannelHubAccount(channelHubAccount, { tag: 'different-tag' });
        const inbox = await createDefaultInboxWorkspace();
        const payload = validPayload({ workspaceTag: 'missing-tag' });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.account_id).toBe(channelHubAccount.id.value);
        expect(email.workspace_id).toBe(inbox.id.value);
        expect(interaction.workspace_id).toBe(inbox.id.value);
        await expectWorkspaceHasNoChannelHubAccounts(inbox.id.value);
    });

    it('uses INBOX workspace id for duplicate replay of no-tag emails', async () => {
        const channelHubAccount = await createChannelHubAccount({ channel_hub_connection_id: 'conn_no_tag_replay' });
        const inbox = await createDefaultInboxWorkspace();
        const payload = validPayload({
            connectionId: 'conn_no_tag_replay',
            payload: {
                tag: undefined,
                messageId: 'no-tag-message-id',
            },
        });

        const first = await createProcessor().execute(payload);
        const second = await createProcessor().execute(payload);

        expect(first.accepted).toBe(true);
        expect(second.accepted).toBe(true);
        expect(second.alreadyProcessed).toBe(true);
        expect(second.code).toBe('already_processed');
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.account_id).toBe(channelHubAccount.id.value);
        expect(email.workspace_id).toBe(inbox.id.value);
        expect(email.message_id).toBe('no-tag-message-id');
        expect(bodyDownloader.download).toHaveBeenCalledTimes(1);
    });

    it('does not route to a Workspace whose tag matches when that Workspace is not assigned to the connectionId account', async () => {
        const routedAccount = await createChannelHubAccount({
            email: 'routed@example.com',
            channel_hub_connection_id: 'conn_routed',
        });
        const unassignedAccount = await createChannelHubAccount({
            email: 'unassigned@example.com',
            channel_hub_connection_id: 'conn_unassigned',
        });
        await createWorkspaceWithChannelHubAccount(routedAccount, { tag: 'different-tag' });
        await createWorkspaceWithChannelHubAccount(unassignedAccount, {
            description: 'Unassigned Matching Tag Workspace',
            tag: 'target-tag',
        });
        const inbox = await createDefaultInboxWorkspace();
        const payload = validPayload({ connectionId: 'conn_routed', workspaceTag: 'target-tag' });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.account_id).toBe(routedAccount.id.value);
        expect(email.workspace_id).toBe(inbox.id.value);
    });

    it('does not search to cc or bcc when recipients match a different Channel Hub account', async () => {
        const routedAccount = await createChannelHubAccount({
            email: 'routed@example.com',
            channel_hub_connection_id: 'conn_routed',
        });
        const recipientAccount = await createChannelHubAccount({
            email: 'support@example.com',
            channel_hub_connection_id: 'conn_recipient',
        });
        const workspace = await createWorkspaceWithChannelHubAccount(routedAccount, { tag: 'target-tag' });
        await createWorkspaceWithChannelHubAccount(recipientAccount, {
            description: 'Recipient Match Workspace',
            tag: 'target-tag',
        });
        const payload = validPayload({ connectionId: 'conn_routed', workspaceTag: 'target-tag' });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const [interaction] = await emailRepository.connection('interactions').select('*');
        expect(email.account_id).toBe(routedAccount.id.value);
        expect(email.workspace_id).toBe(workspace.id.value);
        expect(interaction.workspace_id).toBe(workspace.id.value);
        expect(jsonField(email.bcc)).toEqual([{ email: 'support@example.com', name: 'Support' }]);
    });

    it('returns inconsistency details when connectionId and tag match multiple active workspaces', async () => {
        const channelHubAccount = await createChannelHubAccount({ channel_hub_connection_id: 'conn_duplicate' });
        const workspaceA = await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'Workspace A',
            tag: 'duplicate-tag',
        });
        const workspaceB = await createWorkspaceWithChannelHubAccount(channelHubAccount, {
            description: 'Workspace B',
            tag: 'duplicate-tag',
        });
        const payload = validPayload({ connectionId: 'conn_duplicate', workspaceTag: 'duplicate-tag' });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.retryable).toBe(false);
        expect(result.code).toBe('inconsistent_channel_hub_connection_workspace');
        expect(result.message).toContain(
            "Channel Hub connectionId 'conn_duplicate' with tag 'duplicate-tag' matches multiple active workspaces in KACE."
        );
        expect(result.message).toContain('This is a configuration inconsistency; the email cannot be routed safely.');
        expect(result.message).toContain(`workspaceId=${workspaceA.id.value}`);
        expect(result.message).toContain('workspaceName=Workspace A');
        expect(result.message).toContain(`workspaceId=${workspaceB.id.value}`);
        expect(result.message).toContain('workspaceName=Workspace B');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable and creates no records without downloading when the text body URL is untrusted', async () => {
        const channelHubAccount = await createChannelHubAccount();
        const workspace = await createWorkspaceWithChannelHubAccount(channelHubAccount);
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        allowedConnectionRepository.isAllowedConnection.mockResolvedValue(false);

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_text_body_url');
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedBodyUrl);
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable and creates no records when the downloaded body final URL is untrusted', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        const redirectedUrl = 'https://evil.example.com/messages/msg-1.txt';
        allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== redirectedUrl);
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.from(downloadedPlainText, 'utf8'),
            finalUrl: redirectedUrl,
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_text_body_url');
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedBodyUrl);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(redirectedUrl);
        await expectNoRecordsCreated();
    });

    it('stores a downloaded plain-text body externally when it exceeds the inline limit', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.alloc(maxPlainTextBodyBytes + 1, 'a'),
            contentType: 'text/plain; charset=utf-8',
            finalUrl: allowedBodyUrl,
        });
        bodyStorage.upload.mockResolvedValueOnce({
            s3Key: 'email-bodies/email-id/text-body.txt',
            contentType: 'text/plain; charset=utf-8',
            sizeBytes: maxPlainTextBodyBytes + 1,
            sha256: 'b'.repeat(64),
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(result.code).not.toBe('text_body_too_large');
        expect(bodyStorage.upload).toHaveBeenCalledWith(
            expect.objectContaining({
                part: 'text',
                contentType: 'text/plain; charset=utf-8',
            })
        );

        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_text_storage_mode).toBe('external');
        expect(emailBody.body_text_s3_key).toBe('email-bodies/email-id/text-body.txt');
        expect(emailBody.body_text_preview_truncated).toBeTruthy();
        expect(emailBody.body.length).toBeLessThan(maxPlainTextBodyBytes + 1);
    });

    it.each([
        ['invalid received_at', { received_at: 'not-a-date' }, 'invalid_received_at'],
        ['invalid operatorDate', { operatorDate: 'not-a-date', received_at: undefined }, 'invalid_received_at'],
        ['overlong messageId', { messageId: 'm'.repeat(256) }, 'invalid_external_message_id'],
        ['overlong subject', { subject: 's'.repeat(501) }, 'invalid_subject'],
        ['overlong origin', { origin: `${'a'.repeat(120)}@example.com` }, 'invalid_sender'],
        ['overlong threadId', { threadId: 't'.repeat(256) }, 'invalid_thread_id'],
        ['SQL-like messageId', { messageId: 'select' }, 'invalid_domain_input'],
        ['SQL-like subject', { subject: 'select' }, 'SUBJECT_FORBIDDEN_WORD'],
        [
            'XSS-like recipient name',
            { destination: { to: [], cc: [], bcc: [{ email: 'support@example.com', name: '<script>' }] } },
            'invalid_domain_input',
        ],
    ])('returns non-retryable before download or persistence for %s', async (_name, invalidPayload, expectedCode) => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: invalidPayload,
        });

        await withSqlGuardEnforced(async () => {
            const result = await createProcessor().execute(payload);

            expect(result.nonRetryable).toBe(true);
            expect(result.code).toBe(expectedCode);
            expect(bodyDownloader.download).not.toHaveBeenCalled();
            await expectNoRecordsCreated();
        });
    });

    it('returns SUBJECT_FORBIDDEN_WORD for a Gmail delivery-delay subject', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const subject = 'Delivery Status Notification (Delay)';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { subject },
        });

        await withSqlGuardEnforced(async () => {
            const result = await createProcessor().execute(payload);

            expect(result.nonRetryable).toBe(true);
            expect(result.code).toBe('SUBJECT_FORBIDDEN_WORD');
            expect(result.message).toBe(`Palabras prohibidas detectadas en subject - delay: ${subject}`);
            expect(bodyDownloader.download).not.toHaveBeenCalled();
            await expectNoRecordsCreated();
        });
    });

    it('rolls back Email insert when a later EmailBody insert fails inside the transaction', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        await withFailingInsertTrigger(
            'emails_body',
            'force_email_body_failure',
            'forced email body failure',
            async () => {
                const result = await createProcessor().execute(payload);

                expect(result.retryable).toBe(true);
                await expectNoRecordsCreated();
            }
        );
    });

    it('returns retryable and leaves no records when body download fails', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockRejectedValue(new Error('temporary body download failure'));

        const result = await createProcessor().execute(payload);

        expect(result.retryable).toBe(true);
        expect(result.code).toBe('processing_failed');
        await expectNoRecordsCreated();
    });

    it('returns retryable and leaves no records when database persistence fails', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        await withFailingInsertTrigger(
            'interactions',
            'force_interaction_failure',
            'forced interaction failure',
            async () => {
                const result = await createProcessor().execute(payload);

                expect(result.retryable).toBe(true);
                expect(result.code).toBe('processing_failed');
                await expectNoRecordsCreated();
            }
        );
    });

    it('deletes uploaded attachment storage when database persistence fails after scan', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });

        await withFailingInsertTrigger(
            'interactions',
            'force_interaction_failure',
            'forced interaction failure',
            async () => {
                const result = await createProcessor().execute(payload);

                expect(result.retryable).toBe(true);
                expect(attachmentStorage.delete).toHaveBeenCalledWith('attachments/email-id/uuid_invoice.pdf');
                await expectNoRecordsCreated();
            }
        );
    });

    it('defaults received_at to the current time when operatorDate, received_at, and receivedAt are all absent', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const before = Date.now();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { received_at: undefined, operatorDate: undefined },
        });

        const result = await createProcessor().execute(payload);
        const after = Date.now();

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        const receivedAtMs = new Date(email.received_at).getTime();
        expect(receivedAtMs).toBeGreaterThanOrEqual(before);
        expect(receivedAtMs).toBeLessThanOrEqual(after);
    });

    it('returns non-retryable and creates no records when messageId is missing', async () => {
        const payload = validPayload({ payload: { messageId: undefined } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('missing_external_message_id');
        expect(result.message).toBe('Channel Hub messageId is required.');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable and creates no records when origin is missing', async () => {
        const payload = validPayload({ payload: { origin: undefined } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('missing_sender');
        expect(result.message).toBe('Channel Hub origin is required.');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns non-retryable and creates no records when the plain-text body URL is missing', async () => {
        const payload = validPayload({ payload: { content: {} } });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('missing_text_body_url');
        expect(result.message).toBe('Channel Hub plain-text body URL is required.');
        expect(bodyDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('treats a whitespace-only connectionId as missing', async () => {
        const payload = validPayload({ connectionId: '   ' });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('missing_channel_hub_connection_id');
        await expectNoRecordsCreated();
    });

    it('stores a null thread_id when the Channel Hub threadId is whitespace-only', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { threadId: '   ' },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.thread_id).toBeNull();
    });

    it('resolves the sender when origin is an object with an email property instead of a plain string', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { origin: { email: 'CUSTOMER@EXAMPLE.COM', name: 'Customer' } },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.sender).toBe('customer@example.com');
    });

    it('resolves an object recipient using its address property when email is absent, and defaults its name to null', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: {
                destination: { to: [{ address: 'no-email-field@example.com' }], cc: [], bcc: [] },
            },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(jsonField(email.to)).toEqual([{ email: 'no-email-field@example.com', name: null }]);
    });

    it('falls back to the original HTML body URL when the HTML download response has no finalUrl', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => {
            if (options?.kind === 'html') {
                return { buffer: Buffer.from(downloadedHtml, 'utf8') };
            }
            return { buffer: Buffer.from(downloadedPlainText, 'utf8'), finalUrl: requestedUrl };
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedHtmlBodyUrl);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html).toBe(downloadedHtml);
    });

    it('strips HTML markup from the plain-text body when the text download is detected as HTML by content type', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.from('<p>Actual content</p>', 'utf8'),
            contentType: 'text/html; charset=utf-8',
            finalUrl: allowedBodyUrl,
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body).toBe('Actual content');
        expect(emailBody.body_text_content_type).toBe('text/plain; charset=utf-8');
    });

    it('returns non-retryable text_body_too_large and creates no records when the plain-text body exceeds the external storage limit', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.alloc(EXTERNAL_EMAIL_BODY_MAX_BYTES + 1, 'a'),
            finalUrl: allowedBodyUrl,
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('text_body_too_large');
        expect(result.message).toBe(
            `Plain-text body exceeds ${EXTERNAL_EMAIL_BODY_MAX_BYTES} bytes (received ${EXTERNAL_EMAIL_BODY_MAX_BYTES + 1})`
        );
        await expectNoRecordsCreated();
    });

    it('returns non-retryable html_body_too_large and creates no records when the HTML body exceeds the external storage limit', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => {
            if (options?.kind === 'html') {
                return { buffer: Buffer.alloc(EXTERNAL_EMAIL_BODY_MAX_BYTES + 1, 'b'), finalUrl: requestedUrl };
            }
            return { buffer: Buffer.from(downloadedPlainText, 'utf8'), finalUrl: requestedUrl };
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('html_body_too_large');
        await expectNoRecordsCreated();
    });

    it('stores an HTML body externally without persisting its preview when it exceeds the inline limit', async () => {
        // KACE-BUG: for the HTML part, #prepareBodyPart always returns
        // `bodyHtml: null` on the "stored externally" branch (it only fills
        // `body` there, which is the TEXT column). previewFromHtml(content, ...)
        // is computed but its result is discarded, so body_html ends up NULL
        // instead of holding the truncated HTML preview that was just built.
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => {
            if (options?.kind === 'html') {
                return {
                    buffer: Buffer.alloc(INLINE_EMAIL_BODY_MAX_BYTES + 10, 'b'),
                    finalUrl: requestedUrl,
                };
            }
            return { buffer: Buffer.from(downloadedPlainText, 'utf8'), finalUrl: requestedUrl };
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html_storage_mode).toBe('external');
        expect(emailBody.body_html_preview_truncated).toBeTruthy();
        expect(emailBody.body_html).toBeNull();
    });

    it('persists a null S3 key for an externally-stored body when the storage upload response omits it', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.alloc(maxPlainTextBodyBytes + 1, 'a'),
            finalUrl: allowedBodyUrl,
        });
        bodyStorage.upload.mockResolvedValueOnce({
            contentType: 'text/plain; charset=utf-8',
            sizeBytes: maxPlainTextBodyBytes + 1,
            sha256: 'd'.repeat(64),
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_text_storage_mode).toBe('external');
        expect(emailBody.body_text_s3_key).toBeNull();
    });

    it('returns retryable and leaves no records when the body must be stored externally but no bodyStorage is configured', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        bodyDownloader.download.mockResolvedValue({
            buffer: Buffer.alloc(maxPlainTextBodyBytes + 1, 'a'),
            finalUrl: allowedBodyUrl,
        });

        const result = await createProcessor({ bodyStorage: undefined }).execute(payload);

        expect(result.retryable).toBe(true);
        expect(result.code).toBe('processing_failed');
        await expectNoRecordsCreated();
    });

    it('downloads the shared body only once when the text and HTML URLs are identical', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedBodyUrl } },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(bodyDownloader.download).toHaveBeenCalledTimes(1);
        expect(bodyDownloader.download).toHaveBeenCalledWith(allowedBodyUrl);
    });

    it('returns non-retryable when an attachment entry has no URL at all', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ filename: 'no-url.pdf' }] },
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('missing_attachment_url');
        expect(result.message).toBe('Attachment URL is required.');
        expect(attachmentDownloader.download).not.toHaveBeenCalled();
        await expectNoRecordsCreated();
    });

    it('returns retryable when attachments are present but attachment processing dependencies are not configured', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });

        const result = await createProcessor({ attachmentDownloader: undefined }).execute(payload);

        expect(result.retryable).toBe(true);
        expect(result.code).toBe('processing_failed');
        await expectNoRecordsCreated();
    });

    it('returns non-retryable when a downloaded attachment redirects to an untrusted final URL', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const evilFinalUrl = 'https://evil.example.com/attachments/invoice.pdf';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });
        allowedConnectionRepository.isAllowedConnection.mockImplementation(
            async (checkedUrl) => checkedUrl !== evilFinalUrl
        );
        attachmentDownloader.download.mockResolvedValue({
            buffer: Buffer.from('invoice-file'),
            contentType: 'application/pdf',
            filename: 'invoice.pdf',
            finalUrl: evilFinalUrl,
        });

        const result = await createProcessor().execute(payload);

        expect(result.nonRetryable).toBe(true);
        expect(result.code).toBe('untrusted_attachment_url');
        expect(result.message).toBe('Attachment final URL host is not trusted.');
        expect(attachmentDownloader.download).toHaveBeenCalledWith(attachmentUrl);
        await expectNoRecordsCreated();
    });

    it('accepts an attachment whose download has a non-Buffer body, no filename, and no content type', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl }] },
        });
        attachmentDownloader.download.mockResolvedValue({
            buffer: 'raw-string-body',
            finalUrl: attachmentUrl,
        });
        attachmentStorage.upload.mockResolvedValueOnce({ s3Url: durableAttachmentUrl });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        // `emailId` decide la carpeta de S3 del adjunto: se afirma contra el id REAL del Email
        // persistido y con el objeto completo (sin objectContaining), que antes lo ocultaba.
        const [{ id: persistedEmailId }] = await emailRepository.connection('emails').select('id');
        expect(attachmentStorage.upload).toHaveBeenCalledWith({
            emailId: persistedEmailId,
            buffer: Buffer.from('raw-string-body'),
            contentType: null,
            filename: 'invoice.pdf',
        });
        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.email_id).toBe(persistedEmailId);
        expect(attachment.filename).toBe('invoice.pdf');
        expect(Number(attachment.size)).toBe(Buffer.from('raw-string-body').length);
    });

    it('returns retryable when the post-unique-violation lookup also finds no existing Email', async () => {
        const uniqueViolation = new Error(
            'SQLITE_CONSTRAINT: UNIQUE constraint failed: emails.workspace_id, emails.message_id'
        );
        const connection = {
            transaction: jest.fn().mockRejectedValue(uniqueViolation),
        };
        const fakeEmailRepository = {
            tableName: 'emails',
            connection,
            findByWorkspaceAndMessageId: jest.fn().mockResolvedValue(null),
        };
        const fakeProcessor = new ChannelHubInboundEmailProcessor({
            emailRepository: fakeEmailRepository,
            emailBodyRepository: { tableName: 'emails_body' },
            emailAttachmentRepository: { tableName: 'emails_attachments' },
            interactionRepository: { tableName: 'interactions', findByEmailId: jest.fn() },
            channelHubAccountRepository: {
                findByConnectionId: jest.fn().mockResolvedValue({
                    id: { value: uuidv4() },
                    email: { value: 'support@example.com' },
                    channel_hub_connection_id: { value: defaultConnectionId },
                }),
            },
            workspaceRepository: {
                findActiveByChannelHubAccountIdAndTag: jest.fn().mockResolvedValue([{ id: { value: uuidv4() } }]),
                findDefaultInboxWorkspace: jest.fn(),
            },
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            bodyDownloader: {
                download: jest.fn().mockResolvedValue({ buffer: Buffer.from(downloadedPlainText, 'utf8') }),
            },
            attachmentDownloader: { download: jest.fn() },
            attachmentStorage: { upload: jest.fn() },
            fileScanner: { execute: jest.fn() },
        });

        const result = await fakeProcessor.execute(validPayload({ workspaceTag: 'test-tag' }));

        expect(result.retryable).toBe(true);
        expect(result.code).toBe('processing_failed');
        expect(fakeEmailRepository.findByWorkspaceAndMessageId).toHaveBeenCalledTimes(2);
    });

    it('defaults destination to no recipients when it is entirely absent from the payload', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { destination: undefined },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(jsonField(email.to)).toEqual([]);
        expect(jsonField(email.cc)).toEqual([]);
        expect(jsonField(email.bcc)).toEqual([]);
    });

    it('resolves the sender from an origin object that only has an address property', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { origin: { address: 'ADDRESS-ONLY@EXAMPLE.COM' } },
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [email] = await emailRepository.connection('emails').select('*');
        expect(email.sender).toBe('address-only@example.com');
    });

    it('reuses the plain-text body as the HTML source when the HTML download resolves to nothing', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => {
            if (options?.kind === 'html') {
                return undefined;
            }
            return { buffer: Buffer.from(downloadedPlainText, 'utf8'), finalUrl: requestedUrl };
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html).toBe(downloadedPlainText);
    });

    it('stores a null HTML body when the inline image embedder resolves to null', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => ({
            buffer: Buffer.from(options?.kind === 'html' ? downloadedHtml : downloadedPlainText, 'utf8'),
            finalUrl: requestedUrl,
        }));
        inlineImageEmbedder.execute.mockResolvedValueOnce(null);

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html).toBeNull();
    });

    it('falls back to the original content type, actual buffer length, and computed hash when the storage response omits them', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });
        const oversizedBuffer = Buffer.alloc(maxPlainTextBodyBytes + 1, 'a');
        bodyDownloader.download.mockResolvedValue({
            buffer: oversizedBuffer,
            contentType: 'text/plain; charset=utf-8',
            finalUrl: allowedBodyUrl,
        });
        bodyStorage.upload.mockResolvedValueOnce({});

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_text_s3_key).toBeNull();
        expect(emailBody.body_text_content_type).toBe('text/plain; charset=utf-8');
        expect(Number(emailBody.body_text_size_bytes)).toBe(oversizedBuffer.length);
        expect(emailBody.body_text_sha256).toBe(createHash('sha256').update(oversizedBuffer).digest('hex'));
    });

    it('accepts an attachment whose download resolves an empty object, falling back to the original URL and an empty buffer', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
        });
        attachmentDownloader.download.mockResolvedValue({});

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(attachmentUrl);
        // Igual que arriba: el `emailId` que va al storage debe ser el id real del Email.
        const [{ id: persistedEmailId }] = await emailRepository.connection('emails').select('id');
        expect(attachmentStorage.upload).toHaveBeenCalledWith({
            emailId: persistedEmailId,
            buffer: Buffer.alloc(0),
            contentType: null,
            filename: 'invoice.pdf',
        });
        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.email_id).toBe(persistedEmailId);
        expect(Number(attachment.size)).toBe(0);
    });

    it('falls back to the default filename when an attachment has no filename anywhere and its URL has no path segments', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const rootAttachmentUrl = 'https://channel-hub-cdn.example.com/';
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { attachments: [{ url: rootAttachmentUrl }] },
        });
        attachmentDownloader.download.mockResolvedValue({
            buffer: Buffer.from('bytes'),
            finalUrl: rootAttachmentUrl,
        });

        const result = await createProcessor().execute(payload);

        expect(result.accepted).toBe(true);
        const [attachment] = await emailRepository.connection('emails_attachments').select('*');
        expect(attachment.filename).toBe('attachment');
        expect(Number(attachment.size)).toBe(Buffer.from('bytes').length);
    });

    it('returns already processed with a null interaction_id when the original Interaction record is missing', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({ workspaceTag: workspace.tag.value });

        const first = await createProcessor().execute(payload);
        await emailRepository.connection('interactions').where({ email_id: first.data.email_id }).del();
        const replay = await createProcessor().execute(payload);

        expect(replay.accepted).toBe(true);
        expect(replay.alreadyProcessed).toBe(true);
        expect(replay.data).toEqual({
            already_processed: true,
            email_id: first.data.email_id,
            interaction_id: null,
        });
    });

    it('stores the raw downloaded HTML unrewritten when no inline image embedder is configured', async () => {
        const { workspace } = await createValidWorkspaceAndChannelHubAccount();
        const payload = validPayload({
            workspaceTag: workspace.tag.value,
            payload: { content: { text: allowedBodyUrl, html: allowedHtmlBodyUrl } },
        });
        bodyDownloader.download.mockImplementation(async (requestedUrl, options) => ({
            buffer: Buffer.from(options?.kind === 'html' ? downloadedHtml : downloadedPlainText, 'utf8'),
            finalUrl: requestedUrl,
        }));

        const result = await createProcessor({ inlineImageEmbedder: undefined }).execute(payload);

        expect(result.accepted).toBe(true);
        expect(inlineImageEmbedder.execute).not.toHaveBeenCalled();
        const [emailBody] = await emailRepository.connection('emails_body').select('*');
        expect(emailBody.body_html).toBe(downloadedHtml);
    });
});

describe('ChannelHubInboundTextBodyDownloader', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('rejects an untrusted redirect target before following it', async () => {
        const redirectedUrl = 'https://evil.example.com/messages/msg-1.txt';
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: {
                get: jest.fn((name) => (name === 'location' ? redirectedUrl : null)),
            },
        });
        const allowedConnectionRepository = {
            isAllowedConnection: jest.fn(async (url) => url !== redirectedUrl),
        };
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: maxPlainTextBodyBytes,
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'untrusted_text_body_url',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn).not.toHaveBeenCalledWith(redirectedUrl, expect.any(Object));
    });

    it('uses HTML body error codes for untrusted HTML redirect targets', async () => {
        const redirectedUrl = 'https://evil.example.com/messages/msg-1.html';
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: {
                get: jest.fn((name) => (name === 'location' ? redirectedUrl : null)),
            },
        });
        const allowedConnectionRepository = {
            isAllowedConnection: jest.fn(async (url) => url !== redirectedUrl),
        };
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: maxPlainTextBodyBytes,
        });

        await expect(downloader.download(allowedHtmlBodyUrl, { kind: 'html' })).rejects.toMatchObject({
            nonRetryable: true,
            code: 'untrusted_html_body_url',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn).not.toHaveBeenCalledWith(redirectedUrl, expect.any(Object));
    });

    it('rejects oversized bodies from Content-Length before reading the response body', async () => {
        const arrayBuffer = jest.fn();
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => (name === 'content-length' ? String(maxPlainTextBodyBytes + 1) : null)),
            },
            arrayBuffer,
        });
        const allowedConnectionRepository = {
            isAllowedConnection: jest.fn().mockResolvedValue(true),
        };
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: maxPlainTextBodyBytes,
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'text_body_too_large',
            message: `Plain-text body exceeds ${maxPlainTextBodyBytes} bytes (received ${maxPlainTextBodyBytes + 1})`,
        });
        expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it('uses HTML body error codes for oversized HTML bodies', async () => {
        const arrayBuffer = jest.fn();
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => (name === 'content-length' ? String(maxPlainTextBodyBytes + 1) : null)),
            },
            arrayBuffer,
        });
        const allowedConnectionRepository = {
            isAllowedConnection: jest.fn().mockResolvedValue(true),
        };
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: maxPlainTextBodyBytes,
        });

        await expect(downloader.download(allowedHtmlBodyUrl, { kind: 'html' })).rejects.toMatchObject({
            nonRetryable: true,
            code: 'html_body_too_large',
        });
        expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it('times out body consumption after response headers have returned', async () => {
        jest.useFakeTimers();
        const fetchFn = jest.fn(async () => {
            return {
                status: 200,
                ok: true,
                headers: {
                    get: jest.fn(() => null),
                },
                arrayBuffer: jest.fn(() => new Promise(() => {})),
            };
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            timeoutMs: 10,
        });

        const download = downloader.download(allowedBodyUrl).catch((error) => error);
        await Promise.resolve();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(11);

        const outcome = await Promise.race([download, Promise.resolve('still-pending')]);

        expect(outcome).toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
        });
    });

    it('rejects a streamed body that exceeds max bytes before reading beyond the hard cap', async () => {
        const cancel = jest.fn();
        const read = jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([4, 5, 6]) })
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([7, 8, 9]) });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn(() => null),
            },
            body: {
                getReader: () => ({ read, cancel }),
            },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            maxBytes: 5,
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'text_body_too_large',
        });
        expect(read).toHaveBeenCalledTimes(2);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('uses globalThis.fetch by default and reports a null content type when the header is absent', async () => {
        const originalFetch = globalThis.fetch;
        const arrayBuffer = Uint8Array.from(Buffer.from('hello world')).buffer;
        const stubFetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        });
        globalThis.fetch = stubFetch;

        try {
            const downloader = new ChannelHubInboundTextBodyDownloader({
                allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            });

            const result = await downloader.download(allowedBodyUrl);

            // Objeto de opciones COMPLETO (sin objectContaining): `signal` es lo que hace
            // efectivo el timeout de descarga y antes quedaba fuera del assert.
            expect(stubFetch).toHaveBeenCalledWith(allowedBodyUrl, {
                redirect: 'manual',
                signal: expect.any(AbortSignal),
            });
            expect(result.buffer.toString('utf8')).toBe('hello world');
            expect(result.contentType).toBeNull();
            expect(result.finalUrl).toBe(allowedBodyUrl);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('skips the allowed-connection check and still returns the content type when constructed with no arguments at all', async () => {
        const originalFetch = globalThis.fetch;
        const arrayBuffer = Uint8Array.from(Buffer.from('no-repo')).buffer;
        const stubFetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn((name) => (name === 'content-type' ? 'text/plain' : null)) },
            arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        });
        globalThis.fetch = stubFetch;

        try {
            const downloader = new ChannelHubInboundTextBodyDownloader();

            const result = await downloader.download(allowedBodyUrl);

            expect(result.contentType).toBe('text/plain');
            expect(result.buffer.toString('utf8')).toBe('no-repo');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('rejects when the URL is missing', async () => {
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn: jest.fn(),
            allowedConnectionRepository: { isAllowedConnection: jest.fn() },
        });

        await expect(downloader.download('')).rejects.toMatchObject({
            nonRetryable: true,
            code: 'missing_text_body_url',
            message: 'Plain-text body URL is required.',
        });
    });

    it('rejects when the configured fetchFn is not callable', async () => {
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn: null,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_unavailable',
            message: 'Plain-text body downloader is not available.',
        });
    });

    it('rejects when a redirect response has no Location header', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: { get: jest.fn(() => null) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'invalid_text_body_redirect',
            message: 'Plain-text body redirect is missing a Location header.',
        });
    });

    it('rejects as retryable when the download responds with a non-redirect error status', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 500,
            ok: false,
            headers: { get: jest.fn(() => null) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_failed',
            message: 'Plain-text body download failed with HTTP status 500.',
        });
    });

    it('rejects once the redirect limit is exceeded', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: { get: jest.fn((name) => (name === 'location' ? allowedBodyUrl : null)) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            maxRedirects: 0,
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'too_many_text_body_redirects',
            message: 'Plain-text body download exceeded the redirect limit.',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('rejects as retryable when the fetch call itself throws a non-abort error', async () => {
        const fetchFn = jest.fn().mockRejectedValue(new Error('network unreachable'));
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_failed',
            message: 'Plain-text body download failed.',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('reports a timeout when the fetch call itself rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const fetchFn = jest.fn().mockRejectedValue(abortError);
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
            message: 'Plain-text body download timed out.',
        });
    });

    it('rejects as retryable when the response body cannot be read at all', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_failed',
            message: 'Plain-text body response cannot be read.',
        });
    });

    it('rejects as retryable when reading the array buffer throws a non-abort error', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            arrayBuffer: jest.fn().mockRejectedValue(new Error('stream broke')),
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_failed',
            message: 'Plain-text body download failed.',
        });
    });

    it('reports a timeout when reading the array buffer rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            arrayBuffer: jest.fn().mockRejectedValue(abortError),
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
            message: 'Plain-text body download timed out.',
        });
    });

    it('treats an already-elapsed timeout as immediately aborted once headers return', async () => {
        jest.useFakeTimers();
        const fetchFn = jest.fn(
            () =>
                new Promise((resolve) => {
                    setTimeout(
                        () =>
                            resolve({
                                status: 200,
                                ok: true,
                                headers: { get: jest.fn(() => null) },
                                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
                            }),
                        20
                    );
                })
        );
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            timeoutMs: 5,
        });

        const download = downloader.download(allowedBodyUrl).catch((error) => error);
        await jest.advanceTimersByTimeAsync(25);
        const outcome = await download;

        expect(outcome).toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
            message: 'Plain-text body download timed out.',
        });
    });

    it('rejects as non-retryable when the downloaded buffer exceeds the max size but Content-Length was absent', async () => {
        const arrayBuffer = new Uint8Array(10).buffer;
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            maxBytes: 5,
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'text_body_too_large',
            message: 'Plain-text body exceeds 5 bytes (received 10)',
        });
    });

    it('assembles a streamed body across multiple chunks and returns it once the reader signals done', async () => {
        const cancel = jest.fn();
        const read = jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([104, 105]) })
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([33]) })
            .mockResolvedValueOnce({ done: true, value: undefined });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            body: { getReader: () => ({ read, cancel, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download(allowedBodyUrl);

        expect(result.buffer.toString('utf8')).toBe('hi!');
        expect(cancel).not.toHaveBeenCalled();
    });

    it('rejects as retryable when the stream reader throws a non-abort error', async () => {
        const read = jest.fn().mockRejectedValue(new Error('reader broke'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            body: { getReader: () => ({ read, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_failed',
            message: 'Plain-text body download failed.',
        });
    });

    it('reports a timeout when the stream reader rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const read = jest.fn().mockRejectedValue(abortError);
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: { get: jest.fn(() => null) },
            body: { getReader: () => ({ read, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(allowedBodyUrl)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
            message: 'Plain-text body download timed out.',
        });
    });

    it('aborta de verdad la peticion en vuelo cuando vence timeoutMs (cableado real del AbortSignal)', async () => {
        // No fabricamos el AbortError: dejamos que el AbortController real de download()
        // ejecute `controller.abort()` al vencer timeoutMs y comprobamos que la senal que
        // recibio fetch es exactamente esa. Sin propagar `signal`, la peticion nunca se
        // enteraria del vencimiento.
        jest.useFakeTimers();
        let capturedSignal;
        const fetchFn = jest.fn(
            (_requestedUrl, options) =>
                new Promise((_resolve, reject) => {
                    capturedSignal = options.signal;
                    options.signal.addEventListener('abort', () => {
                        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
                    });
                })
        );
        const downloader = new ChannelHubInboundTextBodyDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            timeoutMs: 10,
        });

        const download = downloader.download(allowedBodyUrl).catch((error) => error);
        await jest.advanceTimersByTimeAsync(11);
        const outcome = await download;

        expect(fetchFn).toHaveBeenCalledWith(allowedBodyUrl, {
            redirect: 'manual',
            signal: expect.any(AbortSignal),
        });
        expect(capturedSignal).toBeInstanceOf(AbortSignal);
        expect(capturedSignal.aborted).toBe(true);
        expect(outcome).toMatchObject({
            nonRetryable: false,
            code: 'text_body_download_timeout',
            message: 'Plain-text body download timed out.',
        });
    });
});
