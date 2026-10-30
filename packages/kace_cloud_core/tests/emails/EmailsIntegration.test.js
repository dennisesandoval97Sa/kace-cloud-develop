import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexEmailsRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsRepository.js';
import EmailMother from './domain/EmailsMother.js';
import { EmailCreator } from '../../src/emails/application/create/EmailCreator.js';
import { KnexEmailsBodyRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexEmailAttachmentRepository } from '../../src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { Helper, TenantContext, ValidationFailError, ValueObjectUuid } from '../../src/shared/index.js';
import { EmailFinder } from '../../src/emails/application/find/EmailFinder.js';
import { EmailResponse } from '../../src/emails/application/EmailResponse.js';
import { EmailUpdater } from '../../src/emails/application/update/EmailUpdater.js';
import { Email } from '../../src/emails/domain/Email.js';
import { EmailBody } from '../../src/emails/domain/EmailBody.js';
import { EmailSearch } from '../../src/emails/application/search/EmailSearcher.js';
import { EmailCollectionResponse } from '../../src/emails/application/EmailCollectionResponse.js';
import { EmailDeleter } from '../../src/emails/application/delete/EmailDeleter.js';
import { KnexMailAccountRepository } from '../../src/mail-accounts/index.js';
import MailAccountMother from '../mail-accounts/domain/MailAccountMother.js';
import { KnexChannelHubAccountRepository } from '../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import TestHelper from '../TestHelper.js';

jest.unstable_mockModule('dotenv', () => ({
    default: { config: jest.fn() },
}));
const databaseEnvConfigPath = fileURLToPath(new URL('../../../kace_cloud_database/env-config.js', import.meta.url));
jest.unstable_mockModule(databaseEnvConfigPath, () => ({
    schema: undefined,
    serviceName: undefined,
}));

describe('Email integration', () => {
    const repository = new KnexEmailsRepository(knexConfig);
    const emailsBodyRepository = new KnexEmailsBodyRepository(repository.connection);
    const emailAttachmentRepository = new KnexEmailAttachmentRepository(repository.connection);
    const mailAccountRepository = new KnexMailAccountRepository(repository.connection);
    const channelHubAccountRepository = new KnexChannelHubAccountRepository(repository.connection);
    const attachmentDownloader = {
        download: jest.fn(async (url) => ({
            buffer: Buffer.from('fake-file'),
            contentType: 'image/jpeg',
            filename: new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'attachment.jpg',
        })),
    };
    const attachmentStorage = {
        upload: jest.fn(async ({ emailId, filename }) => ({
            s3Key: `attachments/${emailId}/mock-${filename}`,
            s3Url: `https://example.com/attachments/${emailId}/mock-${filename}`,
        })),
        delete: jest.fn().mockResolvedValue(),
    };
    const s3FileScanner = {
        execute: jest.fn().mockResolvedValue({
            message: 'File validated successfully',
        }),
    };
    let tenant;

    const createChannelHubAccount = async (overrides = {}) => {
        const id = overrides.id ?? uuidv4();
        const restFlowId = overrides.rest_flow_id ?? uuidv4();
        const now = new Date().toISOString();

        await repository.connection('ws_rest_flows').insert({
            id: restFlowId,
            description: overrides.flow_description ?? `Flow ${id}`,
            is_active: true,
            created_at: now,
            created_by: uuidv4(),
            updated_at: now,
            updated_by: uuidv4(),
        });

        await repository.connection('channel_hub_accounts').insert({
            id,
            email: overrides.email ?? 'to@example.com',
            name: overrides.name ?? `Channel Hub ${id}`,
            country_id: overrides.country_id ?? 'CO',
            operator_id: overrides.operator_id ?? 'imap',
            rest_flow_id: restFlowId,
            channel_hub_connection_id: overrides.channel_hub_connection_id ?? `conn_${id}`,
            is_active: overrides.is_active ?? true,
            created_at: now,
            created_by: uuidv4(),
            updated_at: now,
            updated_by: uuidv4(),
            deleted_at: overrides.deleted_at ?? null,
            deleted_by: overrides.deleted_by ?? null,
            channel_hub_error: overrides.channel_hub_error ?? null,
        });

        return { id, email: overrides.email ?? 'to@example.com' };
    };

    beforeAll(async () => {
        tenant = await new LocalTenantRepository().find(ValueObjectUuid.random());
    });

    beforeEach(async () => {
        attachmentDownloader.download.mockClear();
        attachmentStorage.upload.mockClear();
        attachmentStorage.delete.mockReset();
        attachmentStorage.delete.mockResolvedValue();
        s3FileScanner.execute.mockClear();
        s3FileScanner.execute.mockResolvedValue({
            message: 'File validated successfully',
        });
    });

    it('should create a Email', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();

            const dto = EmailMother.dto({ account_id: channelHubAccount.id });
            // El dto no pasa por `createEmail`, que es quien respalda el
            // workspace; sin esto el insert cae por clave foranea.
            await EmailMother.ensureRelations(repository.connection, dto);

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const result = await repository.connection('emails').select('*').where('id', dto.id);

            expect(result.length).toBe(1);
        });
    });

    it('should use an explicit Channel Hub account_id without resolving it from sender', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
            const dto = EmailMother.dto({
                account_id: channelHubAccount.id,
                sender: 'customer@example.com',
                to: [{ name: 'Unmatched Recipient', email: 'not-a-channel-hub-account@example.com' }],
            });
            await EmailMother.ensureRelations(repository.connection, dto);

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail.account_id).toBe(channelHubAccount.id);
            expect(storedEmail.sender).toBe('customer@example.com');
        });
    });

    it('should infer account_id from the delivered Channel Hub recipient', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount({ email: 'support@example.com' });
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: [{ name: 'Customer Copy', email: 'customer-copy@example.com' }],
                cc: [{ name: 'Support', email: 'Support@Example.com' }],
                bcc: [],
            });
            delete dto.account_id;
            await EmailMother.ensureRelations(repository.connection, dto);

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail.account_id).toBe(channelHubAccount.id);
            expect(storedEmail.sender).toBe('customer@example.com');
        });
    });

    it('should reject create when recipients do not resolve a Channel Hub account, even if sender matches a Mail Account', async () => {
        await TenantContext.run(tenant, async () => {
            await MailAccountMother.createMailAccount(mailAccountRepository, {
                email_account: 'legacy-mail-account@example.com',
            });
            const dto = EmailMother.dto({
                sender: 'legacy-mail-account@example.com',
                to: [{ name: 'Customer', email: 'customer@example.com' }],
                cc: [],
                bcc: [],
            });
            delete dto.account_id;

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Receiving Channel Hub account could not be resolved from email recipients.'
            );
            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('should reject create when recipients resolve more than one Channel Hub account', async () => {
        await TenantContext.run(tenant, async () => {
            await createChannelHubAccount({ email: 'support-a@example.com' });
            await createChannelHubAccount({ email: 'support-b@example.com' });
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: [{ name: 'Support A', email: 'support-a@example.com' }],
                cc: [{ name: 'Support B', email: 'support-b@example.com' }],
                bcc: [],
            });
            delete dto.account_id;

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Receiving Channel Hub account is ambiguous; provide account_id.'
            );
            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('should reject create when explicit account_id is not a Channel Hub account', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: [{ name: 'Support', email: 'support@example.com' }],
            });

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                `Channel Hub account with id ${dto.account_id} not found.`
            );
            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('should reject create when the explicit account_id resolves to an inactive Channel Hub account', async () => {
        await TenantContext.run(tenant, async () => {
            const inactiveAccount = await createChannelHubAccount({
                email: 'inactive-support@example.com',
                is_active: false,
            });
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: [{ name: 'Inactive Support', email: 'inactive-support@example.com' }],
                account_id: inactiveAccount.id,
            });

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                `Channel Hub account with id ${inactiveAccount.id} is inactive.`
            );
            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('should ignore inactive Channel Hub accounts among the matching recipients and resolve the active one', async () => {
        await TenantContext.run(tenant, async () => {
            const activeAccount = await createChannelHubAccount({ email: 'active-support@example.com' });
            await createChannelHubAccount({ email: 'inactive-support@example.com', is_active: false });
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: [{ name: 'Active Support', email: 'active-support@example.com' }],
                cc: [{ name: 'Inactive Support', email: 'inactive-support@example.com' }],
                bcc: [],
            });
            delete dto.account_id;
            await EmailMother.ensureRelations(repository.connection, dto);

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail.account_id).toBe(activeAccount.id);
        });
    });

    it('should resolve a Channel Hub account from recipients even when some entries are malformed', async () => {
        await TenantContext.run(tenant, async () => {
            const account = await createChannelHubAccount({ email: 'plain-string-support@example.com' });
            const dto = EmailMother.dto({
                sender: 'customer@example.com',
                to: ['plain-string-support@example.com'],
                cc: [{ name: 'No email field here' }],
                bcc: { note: 'not an array of recipients' },
            });
            delete dto.account_id;
            await EmailMother.ensureRelations(repository.connection, dto);

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const storedEmail = await repository.connection('emails').where({ id: dto.id }).first();
            expect(storedEmail.account_id).toBe(account.id);
        });
    });

    it('should throw an error when creating an existing email', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const email = await EmailMother.createEmail(repository, { account_id: channelHubAccount.id });
            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            const dto = { ...EmailMother.dto({ account_id: channelHubAccount.id }), id: email.id };
            await expect(emailCreator.execute(dto)).rejects.toThrowError(ValidationFailError);
        });
    });

    it('should map duplicate email inserts to validation failures', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});

        try {
            await TenantContext.run(tenant, async () => {
                const dto = await EmailMother.createEmail(repository);
                const duplicateEmail = Email.create(dto);

                await expect(repository.save(duplicateEmail)).rejects.toThrow(ValidationFailError);
            });
        } finally {
            logSpy.mockRestore();
        }
    });

    it('can i get a existing Email', async () => {
        const email = await EmailMother.createEmailWithRelations(
            repository,
            emailsBodyRepository,
            emailAttachmentRepository
        );

        const emailFinder = new EmailFinder(repository, emailsBodyRepository, emailAttachmentRepository);

        const emailResult = await emailFinder.execute(email.id);

        expect(emailResult).not.toBeNull();
        expect(emailResult).toBeInstanceOf(EmailResponse);

        const json = emailResult.toJson();
        expect(json.data?.id).toBe(email.id);
        expect(json.data?.body).not.toBeNull();
        expect(json.data?.body).toMatchObject({
            body: '<p>Body de prueba</p>',
            body_html: '<article><p>HTML Body de prueba</p></article>',
        });
        expect(json.data.attachments?.length).toBe(1);
        expect(json.data.attachments?.[0]).toMatchObject({
            filename: 'file.pdf',
            name: 'file.pdf',
        });
    });

    it('should update an existing Email', async () => {
        const email = await EmailMother.createEmail(repository);
        const emailUpdater = new EmailUpdater(repository, emailsBodyRepository, emailAttachmentRepository);

        const data = { subject: 'Updated Subject' };

        await emailUpdater.execute(data, email.id);

        const result = await repository.find(new ValueObjectUuid('id', email.id));

        expect(result).toBeInstanceOf(Email);
        expect(result.subject.value).toBe('Updated Subject');
    });

    it('should throw an error when updating a non-existent email', async () => {
        const nonExistentId = uuidv4();
        const emailUpdater = new EmailUpdater(repository, emailsBodyRepository, emailAttachmentRepository);

        const updateData = { subject: 'Updated Subject' };

        await expect(emailUpdater.execute(updateData, nonExistentId)).rejects.toThrow(
            `Email that you are trying to update does not exist`
        );
    });

    it('searches for Banner instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await EmailMother.createEmail(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const emailSearch = new EmailSearch(repository);

        const emaiResult = await emailSearch.execute(dtoCriteria);
        expect(emaiResult).toBeInstanceOf(EmailCollectionResponse);
        expect(Number(emaiResult.toJson().metadata.count)).toEqual(10);
    });

    it('return null if not found a record', async () => {
        const emailFinder = new EmailFinder(repository);

        await expect(emailFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('can delete a existing email (soft delete)', async () => {
        const email = await EmailMother.createEmail(repository);
        const emailDeleter = new EmailDeleter(repository, emailsBodyRepository, emailAttachmentRepository);

        const dto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await emailDeleter.execute(email.id, dto);

        const result = await repository.find(email.id);

        expect(result).not.toBeNull();
        expect(result.deleted_at.value).toBe(dto.deleted_at);
        expect(result.deleted_by.value).toBe(dto.deleted_by);
    });

    it('cascades the soft delete to the email body', async () => {
        const emailDto = await EmailMother.createEmail(repository);
        await emailsBodyRepository.save(
            EmailBody.create({
                id: uuidv4(),
                email_id: emailDto.id,
                body: 'Body to be soft-deleted',
                created_at: new Date().toISOString(),
                created_by: emailDto.created_by,
            })
        );
        const emailDeleter = new EmailDeleter(repository, emailsBodyRepository, emailAttachmentRepository);

        const dto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await emailDeleter.execute(emailDto.id, dto);

        const bodyRow = await repository.connection('emails_body').where('email_id', emailDto.id).first();

        expect(bodyRow.deleted_at).not.toBeNull();
        expect(bodyRow.deleted_by).toBe(dto.deleted_by);
    });

    // BUG (documented, not fixed): KnexEmailAttachmentRepository.findByEmailId() returns
    // raw Knex rows (see its implementation: `this.read.table('emails_attachments')...`
    // with no `new EmailAttachment(...)` wrapping), unlike findByEmailBodyId() on the body
    // repository, which does wrap its row in a domain instance. EmailDeleter#execute()
    // assumes every item from findByEmailId() is a domain EmailAttachment and calls
    // `att.delete(dto)` on it. Deleting any email that still has attachments therefore
    // throws `TypeError: att.delete is not a function` instead of cascading the soft
    // delete, and the email/body deletes that already ran are NOT rolled back (no
    // transaction wraps EmailDeleter#execute).
    it('throws (bug) instead of cascading the soft delete when the email has attachments', async () => {
        const email = await EmailMother.createEmailWithRelations(
            repository,
            emailsBodyRepository,
            emailAttachmentRepository
        );
        const emailDeleter = new EmailDeleter(repository, emailsBodyRepository, emailAttachmentRepository);

        const dto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(emailDeleter.execute(email.id, dto)).rejects.toThrow('att.delete is not a function');
    });

    it('should throw an error if email to delete does not exist', async () => {
        const nonExistentId = uuidv4();
        const emailDeleter = new EmailDeleter(repository, emailsBodyRepository, emailAttachmentRepository);

        await expect(
            emailDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(ValidationFailError);
    });

    it('should create an email with body and attachments', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);

            const bodyDto = {
                id: uuidv4(),
                email_id: emailDto.id,
                body: 'This is the body of the email',
                body_html: '<p>This is the HTML body of the email</p>',
                created_at: new Date().toISOString(),
                created_by: uuidv4(),
            };

            const attachmentsDto = [
                {
                    id: uuidv4(),
                    email_id: emailDto.id,
                    url: 'https://example.com/attachment1.pdf',
                    size: 1024,
                    filename: 'attachment1.pdf',
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
                {
                    id: uuidv4(),
                    email_id: emailDto.id,
                    url: 'https://example.com/attachment2.png',
                    size: 2048,
                    filename: 'attachment2.png',
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            ];

            const dto = {
                ...emailDto,
                body: bodyDto,
                attachments: attachmentsDto,
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await emailCreator.execute(dto);

            const emails = await repository.connection('emails').select('*').where('id', emailDto.id);
            expect(emails.length).toBe(1);

            const bodies = await repository.connection('emails_body').select('*').where('email_id', emailDto.id);
            expect(bodies.length).toBe(1);
            expect(bodies[0].body).toBe(bodyDto.body);
            expect(bodies[0].body_html).toBe(bodyDto.body_html);

            const attachments = await repository
                .connection('emails_attachments')
                .select('*')
                .where('email_id', emailDto.id)
                .orderBy('filename');
            expect(attachments.length).toBe(attachmentsDto.length);
            expect(attachments.map((a) => a.url)).toEqual([
                `https://example.com/attachments/${emailDto.id}/mock-attachment1.pdf`,
                `https://example.com/attachments/${emailDto.id}/mock-attachment2.png`,
            ]);
            expect(attachments.map((a) => a.filename)).toEqual(attachmentsDto.map((a) => a.filename));
        });
    });

    it('should not persist email or attachment rows when attachment scan fails', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            s3FileScanner.execute.mockResolvedValueOnce({
                message: 'File rejected',
            });

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/bad.pdf',
                        size: 1024,
                        filename: 'bad.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(CustomError);

            const email = await repository.connection('emails').select('*').where('id', emailDto.id).first();
            const attachments = await repository
                .connection('emails_attachments')
                .select('*')
                .where('email_id', emailDto.id);

            expect(email).toBeUndefined();
            expect(attachments).toEqual([]);
            expect(attachmentStorage.delete).toHaveBeenCalledWith(`attachments/${emailDto.id}/mock-bad.pdf`);
        });
    });

    it('should log when uploaded attachment cleanup fails', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});

        try {
            await TenantContext.run(tenant, async () => {
                const channelHubAccount = await createChannelHubAccount();
                const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
                s3FileScanner.execute.mockResolvedValueOnce({
                    message: 'File rejected',
                });
                attachmentStorage.delete.mockRejectedValueOnce(new Error('delete denied'));

                const dto = {
                    ...emailDto,
                    attachments: [
                        {
                            id: uuidv4(),
                            email_id: emailDto.id,
                            url: 'https://example.com/bad-cleanup.pdf',
                            size: 1024,
                            filename: 'bad-cleanup.pdf',
                            created_at: new Date().toISOString(),
                            created_by: uuidv4(),
                        },
                    ],
                };

                const emailCreator = new EmailCreator(
                    repository,
                    emailsBodyRepository,
                    emailAttachmentRepository,
                    channelHubAccountRepository,
                    attachmentDownloader,
                    attachmentStorage,
                    s3FileScanner
                );

                await expect(emailCreator.execute(dto)).rejects.toThrow(CustomError);
                expect(logSpy).toHaveBeenCalledWith('Failed to clean up orphaned S3 attachments', {
                    s3Keys: [`attachments/${emailDto.id}/mock-bad-cleanup.pdf`],
                });
            });
        } finally {
            logSpy.mockRestore();
        }
    });

    it('should fail clearly when attachment storage does not return S3 metadata', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            attachmentStorage.upload.mockResolvedValueOnce({ s3Url: 'https://example.com/missing-key.pdf' });

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/missing-key.pdf',
                        size: 1024,
                        filename: 'missing-key.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Attachment missing-key.pdf was uploaded without durable S3 metadata.'
            );
            expect(s3FileScanner.execute).not.toHaveBeenCalled();
        });
    });

    it('should fail clearly when attachment storage returns an s3Key without a public S3 url', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            attachmentStorage.upload.mockResolvedValueOnce({
                s3Key: `attachments/${emailDto.id}/mock-missing-url.pdf`,
            });

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/missing-url.pdf',
                        size: 1024,
                        filename: 'missing-url.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Attachment missing-url.pdf was uploaded without durable S3 metadata.'
            );
            expect(attachmentStorage.delete).toHaveBeenCalledWith(`attachments/${emailDto.id}/mock-missing-url.pdf`);
        });
    });

    it('falls back to the downloaded file name and size when the attachment DTO omits them', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/uploads/derived-name.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await emailCreator.execute(dto);

            const storedAttachment = await repository
                .connection('emails_attachments')
                .where('email_id', emailDto.id)
                .first();

            expect(storedAttachment.filename).toBe('derived-name.pdf');
            expect(Number(storedAttachment.size)).toBe(Buffer.from('fake-file').length);
        });
    });

    it('reports the original attachment url when neither the DTO nor the download response carry a filename', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            attachmentDownloader.download.mockResolvedValueOnce({
                buffer: Buffer.from('no-name'),
                contentType: 'application/octet-stream',
                filename: null,
            });
            attachmentStorage.upload.mockResolvedValueOnce({ s3Key: `attachments/${emailDto.id}/mock-nameless` });

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/uploads/nameless-attachment',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Attachment https://example.com/uploads/nameless-attachment was uploaded without durable S3 metadata.'
            );
        });
    });

    it('fails clearly when attachment processing dependencies are not configured', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });

            const dto = {
                ...emailDto,
                attachments: [
                    {
                        id: uuidv4(),
                        email_id: emailDto.id,
                        url: 'https://example.com/no-deps.pdf',
                        size: 10,
                        filename: 'no-deps.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'Email attachment processing dependencies are not configured.'
            );
            const storedEmail = await repository.connection('emails').where('id', emailDto.id).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('should report duplicate attachment IDs as validation failures and roll back the email', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});

        try {
            await TenantContext.run(tenant, async () => {
                const channelHubAccount = await createChannelHubAccount();
                const existingEmail = await EmailMother.createEmail(repository, {
                    account_id: channelHubAccount.id,
                });
                const duplicateAttachmentId = uuidv4();
                await repository.connection('emails_attachments').insert({
                    id: duplicateAttachmentId,
                    email_id: existingEmail.id,
                    url: 'https://example.com/existing.pdf',
                    size: 100,
                    filename: 'existing.pdf',
                    created_at: new Date().toISOString(),
                    created_by: existingEmail.created_by,
                });

                const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
                await EmailMother.ensureRelations(repository.connection, emailDto);
                const dto = {
                    ...emailDto,
                    attachments: [
                        {
                            id: duplicateAttachmentId,
                            email_id: emailDto.id,
                            url: 'https://example.com/duplicate.pdf',
                            size: 1024,
                            filename: 'duplicate.pdf',
                            created_at: new Date().toISOString(),
                            created_by: uuidv4(),
                        },
                    ],
                };

                const emailCreator = new EmailCreator(
                    repository,
                    emailsBodyRepository,
                    emailAttachmentRepository,
                    channelHubAccountRepository,
                    attachmentDownloader,
                    attachmentStorage,
                    s3FileScanner
                );

                await expect(emailCreator.execute(dto)).rejects.toThrow(ValidationFailError);

                const email = await repository.connection('emails').where('id', emailDto.id).first();
                const attachments = await repository.connection('emails_attachments').where('email_id', emailDto.id);

                expect(email).toBeUndefined();
                expect(attachments).toEqual([]);
                expect(attachmentStorage.delete).toHaveBeenCalledWith(`attachments/${emailDto.id}/mock-duplicate.pdf`);
            });
        } finally {
            logSpy.mockRestore();
        }
    });

    it('should create an email with external body metadata from tenant S3 references', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const textSizeBytes = Buffer.byteLength('Full external text body', 'utf8');
            const htmlSizeBytes = Buffer.byteLength('<article>Full external HTML body</article>', 'utf8');
            const bodyStorage = {
                extractTenantUploadObjectKey: jest
                    .fn()
                    .mockReturnValueOnce(`email-bodies/${emailDto.id}/text-body.txt`)
                    .mockReturnValueOnce(`email-bodies/${emailDto.id}/html-body.html`),
                head: jest
                    .fn()
                    .mockResolvedValueOnce({ sizeBytes: textSizeBytes, contentType: 'text/plain; charset=utf-8' })
                    .mockResolvedValueOnce({ sizeBytes: htmlSizeBytes, contentType: 'text/html; charset=utf-8' }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'Full external text body',
                    body_html: null,
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-body.txt`,
                        size_bytes: textSizeBytes,
                        content_type: 'text/plain; charset=utf-8',
                        sha256: createHash('sha256').update('Full external text body').digest('hex'),
                    },
                    html: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/html-body.html`,
                        size_bytes: htmlSizeBytes,
                        content_type: 'text/html; charset=utf-8',
                        sha256: createHash('sha256').update('<article>Full external HTML body</article>').digest('hex'),
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await emailCreator.execute(dto);

            const body = await repository.connection('emails_body').select('*').where('email_id', emailDto.id).first();
            expect(body.body_text_storage_mode).toBe('external');
            expect(body.body_text_s3_key).toBe(`email-bodies/${emailDto.id}/text-body.txt`);
            expect(Number(body.body_text_size_bytes)).toBe(textSizeBytes);
            expect(body.body_text_preview_truncated).toBeTruthy();
            expect(body.body_html).toBeNull();
            expect(body.body_html_storage_mode).toBe('external');
            expect(body.body_html_s3_key).toBe(`email-bodies/${emailDto.id}/html-body.html`);
            expect(Number(body.body_html_size_bytes)).toBe(htmlSizeBytes);
            expect(body.body_html_preview_truncated).toBeTruthy();
        });
    });

    it('rejects a body that provides both an external HTML reference and an inline body_html', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const htmlSizeBytes = Buffer.byteLength('<article>External HTML body</article>', 'utf8');
            const bodyStorage = {
                extractTenantUploadObjectKey: jest
                    .fn()
                    .mockReturnValue(`email-bodies/${emailDto.id}/html-conflict.html`),
                head: jest.fn().mockResolvedValue({ sizeBytes: htmlSizeBytes }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'Fallback text',
                    body_html: '<p>Conflicting inline html</p>',
                    html: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/html-conflict.html`,
                        size_bytes: htmlSizeBytes,
                        sha256: createHash('sha256').update('<article>External HTML body</article>').digest('hex'),
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'body.body_html cannot be provided when body.html.s3_url is provided.'
            );
            const storedEmail = await repository.connection('emails').where('id', emailDto.id).first();
            expect(storedEmail).toBeUndefined();
        });
    });

    it('stores a null body_html when the body has neither inline nor external HTML content', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'Plain text only, no HTML at all',
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );

            await emailCreator.execute(dto);

            const body = await repository.connection('emails_body').where('email_id', emailDto.id).first();
            expect(body.body).toBe('Plain text only, no HTML at all');
            expect(body.body_html).toBeNull();
        });
    });

    it('rejects external body metadata whose size_bytes is not a valid non-negative number', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest.fn().mockReturnValue(`email-bodies/${emailDto.id}/text-bad.txt`),
                head: jest.fn().mockResolvedValue({ sizeBytes: 10 }),
            };
            const baseDto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-bad.txt`,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };
            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            const nonFiniteDto = {
                ...baseDto,
                body: { ...baseDto.body, text: { ...baseDto.body.text, size_bytes: 'not-a-number' } },
            };
            await expect(emailCreator.execute(nonFiniteDto)).rejects.toThrow(
                'External email body size_bytes must be a non-negative number.'
            );

            const negativeDto = {
                ...baseDto,
                body: { ...baseDto.body, text: { ...baseDto.body.text, size_bytes: -10 } },
            };
            await expect(emailCreator.execute(negativeDto)).rejects.toThrow(
                'External email body size_bytes must be a non-negative number.'
            );
        });
    });

    it('rejects external body metadata whose size_bytes does not match the stored S3 object', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest
                    .fn()
                    .mockReturnValue(`email-bodies/${emailDto.id}/text-mismatch.txt`),
                head: jest.fn().mockResolvedValue({ sizeBytes: 999 }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-mismatch.txt`,
                        size_bytes: 42,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'External email body size_bytes does not match the S3 object.'
            );
        });
    });

    it('defaults the content type per body part when the DTO omits it', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const textSizeBytes = Buffer.byteLength('No content type text', 'utf8');
            const htmlSizeBytes = Buffer.byteLength('<p>No content type html</p>', 'utf8');
            const bodyStorage = {
                extractTenantUploadObjectKey: jest
                    .fn()
                    .mockReturnValueOnce(`email-bodies/${emailDto.id}/text-default.txt`)
                    .mockReturnValueOnce(`email-bodies/${emailDto.id}/html-default.html`),
                head: jest
                    .fn()
                    .mockResolvedValueOnce({ sizeBytes: textSizeBytes })
                    .mockResolvedValueOnce({ sizeBytes: htmlSizeBytes }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'No content type text',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-default.txt`,
                        size_bytes: textSizeBytes,
                        sha256: 'irrelevant-sha',
                    },
                    html: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/html-default.html`,
                        size_bytes: htmlSizeBytes,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await emailCreator.execute(dto);

            const body = await repository.connection('emails_body').where('email_id', emailDto.id).first();
            expect(body.body_text_content_type).toBe('text/plain; charset=utf-8');
            expect(body.body_html_content_type).toBe('text/html; charset=utf-8');
        });
    });

    it('fails clearly when an external body part is referenced but no body storage is configured', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-body.txt`,
                        size_bytes: 10,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
                // bodyStorage intentionally omitted
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow('Email body storage is not configured.');
        });
    });

    it('wraps failures while extracting the tenant S3 object key as validation errors', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest.fn().mockImplementation(() => {
                    throw new Error('External email body URL must use https.');
                }),
                head: jest.fn(),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `http://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-body.txt`,
                        size_bytes: 10,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow('External email body URL must use https.');
            expect(bodyStorage.head).not.toHaveBeenCalled();
        });
    });

    it('rejects external body objects that cannot be verified in tenant S3', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest
                    .fn()
                    .mockReturnValue(`email-bodies/${emailDto.id}/text-unverifiable.txt`),
                head: jest.fn().mockResolvedValue({}),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-unverifiable.txt`,
                        size_bytes: 10,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'External email body object could not be verified in tenant S3.'
            );
        });
    });

    it('rejects external body keys stored outside the current email prefix', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest.fn().mockReturnValue(`email-bodies/${uuidv4()}/text-body.txt`),
                head: jest.fn().mockResolvedValue({ sizeBytes: 10 }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/text-body.txt`,
                        size_bytes: 10,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                `External email body object must be stored under email-bodies/${emailDto.id}/.`
            );
        });
    });

    it('rejects external body keys whose filename does not match the expected part and extension', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);
            const bodyStorage = {
                extractTenantUploadObjectKey: jest.fn().mockReturnValue(`email-bodies/${emailDto.id}/wrong-name.txt`),
                head: jest.fn().mockResolvedValue({ sizeBytes: 10 }),
            };
            const dto = {
                ...emailDto,
                body: {
                    id: uuidv4(),
                    body: 'irrelevant',
                    text: {
                        s3_url: `https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/${emailDto.id}/wrong-name.txt`,
                        size_bytes: 10,
                        sha256: 'irrelevant-sha',
                    },
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner,
                bodyStorage
            );

            await expect(emailCreator.execute(dto)).rejects.toThrow(
                'External email body object filename must match text-*.txt.'
            );
        });
    });

    it('should update an existing Email with body and attachments', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const emailDto = EmailMother.dto({ account_id: channelHubAccount.id });
            await EmailMother.ensureRelations(repository.connection, emailDto);

            const bodyDto = {
                id: uuidv4(),
                email_id: emailDto.id,
                body: 'Initial body content',
                body_html: '<p>Initial HTML body content</p>',
                created_at: new Date().toISOString(),
                created_by: uuidv4(),
            };

            const attachmentsDto = [
                {
                    id: uuidv4(),
                    email_id: emailDto.id,
                    url: 'https://example.com/old_attachment1.pdf',
                    size: 512,
                    filename: 'old_attachment1.pdf',
                    created_at: new Date().toISOString(),
                    created_by: uuidv4(),
                },
            ];

            const createDto = {
                ...emailDto,
                body: bodyDto,
                attachments: attachmentsDto,
            };

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository,
                attachmentDownloader,
                attachmentStorage,
                s3FileScanner
            );
            await emailCreator.execute(createDto);

            const updaterDto = {
                subject: 'Updated Subject',
                body: {
                    ...bodyDto,
                    body: 'Updated body content',
                    body_html: '<p>Updated HTML content</p>',
                    updated_at: new Date().toISOString(),
                    updated_by: uuidv4(),
                },
                attachments: [
                    {
                        id: uuidv4(),
                        url: 'https://example.com/new_attachment.pdf',
                        size: 1024,
                        filename: 'new_attachment.pdf',
                        created_at: new Date().toISOString(),
                        created_by: uuidv4(),
                    },
                ],
            };

            const emailUpdater = new EmailUpdater(repository, emailsBodyRepository, emailAttachmentRepository);

            await emailUpdater.execute(updaterDto, emailDto.id);

            const updatedEmail = await repository.find(new ValueObjectUuid('id', emailDto.id));
            expect(updatedEmail).toBeInstanceOf(Email);
            expect(updatedEmail.subject.value).toBe('Updated Subject');

            const updatedBody = await repository
                .connection('emails_body')
                .select('*')
                .where('email_id', emailDto.id)
                .first();
            expect(updatedBody.body).toBe('Updated body content');
            expect(updatedBody.body_html).toBe('<p>Updated HTML content</p>');

            const updatedAttachments = await repository
                .connection('emails_attachments')
                .select('*')
                .where('email_id', emailDto.id)
                .whereNull('deleted_at');
            expect(updatedAttachments.length).toBe(1);
            expect(updatedAttachments[0].url).toBe('https://example.com/new_attachment.pdf');
            expect(updatedAttachments[0].size).toBe(1024);
            expect(updatedAttachments[0].filename).toBe('new_attachment.pdf');
        });
    });

    it('should fail when sender is null', async () => {
        await TenantContext.run(tenant, async () => {
            const channelHubAccount = await createChannelHubAccount();
            const dto = EmailMother.dto({ account_id: channelHubAccount.id });
            dto.sender = null;

            const emailCreator = new EmailCreator(
                repository,
                emailsBodyRepository,
                emailAttachmentRepository,
                channelHubAccountRepository
            );
            await expect(emailCreator.execute(dto)).rejects.toThrow('sender: The value cannot be null');
        });
    });
});
