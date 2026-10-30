import { jest } from '@jest/globals';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';

const send = jest.fn();
const gmailFactory = jest.fn().mockImplementation((options) =>
    // @googleapis/gmail freezes the object it returns (googleapis-common's getAPI does
    // `Object.freeze(ep)`), and it never exposes a top-level `.options` property - auth
    // must be supplied through the factory options, not assigned afterwards.
    Object.freeze({
        _constructedWith: options,
        users: { messages: { send } },
    })
);

jest.unstable_mockModule('@googleapis/gmail', () => ({
    gmail: gmailFactory,
}));

const { GmailClientService } = await import('../../../src/mails/infrastructure/google/GmailClientService.js');
const { MailAccount } = await import('../../../src/mail-accounts/index.js');

describe('GmailClientService auth wiring', () => {
    const buildAccount = (type, overrides = {}) =>
        MailAccount.create({
            id: uuidv4(),
            description: 'Gmail account under test',
            type,
            client_id: 'client-id-value',
            client_secret: 'client-secret-value',
            refresh_token: 'refresh-token-value',
            from_address: 'application@example.com',
            is_active: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        });

    let refreshAccessTokenSpy;

    beforeEach(() => {
        gmailFactory.mockClear();
        send.mockReset();
        send.mockResolvedValue({ data: { id: 'sent-message-id' } });
        refreshAccessTokenSpy = jest
            .spyOn(OAuth2Client.prototype, 'refreshAccessToken')
            .mockResolvedValue({ credentials: { access_token: 'fresh-access-token' } });
    });

    afterEach(() => {
        refreshAccessTokenSpy.mockRestore();
    });

    it('passes the OAuth2Client through the gmail() factory options instead of mutating the returned client', async () => {
        const mailAccount = buildAccount('gmail_application');
        const service = new GmailClientService(mailAccount);

        await service.sendMailApplication(['to@example.com'], 'Subject', '<p>Body</p>');

        expect(gmailFactory).toHaveBeenCalledTimes(1);
        const [options] = gmailFactory.mock.calls[0];
        expect(options.version).toBe('v1');
        expect(options.auth).toBeInstanceOf(OAuth2Client);
    });

    it('does not throw "Cannot set properties of undefined (setting \'auth\')" on a frozen gmail client', async () => {
        const mailAccount = buildAccount('gmail_application');
        const service = new GmailClientService(mailAccount);

        await expect(service.sendMailApplication(['to@example.com'], 'Subject', '<p>Body</p>')).resolves.toEqual({
            id: 'sent-message-id',
        });
    });

    it('sends as the configured mailbox address for GMAIL_APPLICATION', async () => {
        const mailAccount = buildAccount('gmail_application', { from_address: 'application@example.com' });
        const service = new GmailClientService(mailAccount);

        await service.sendMailApplication(['to@example.com'], 'Subject', '<p>Body</p>');

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'application@example.com' }));
    });

    it('sends as "me" for GMAIL_USER', async () => {
        const mailAccount = buildAccount('gmail_user');
        const service = new GmailClientService(mailAccount);

        await service.sendMailUser(['to@example.com'], 'Subject', '<p>Body</p>');

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'me' }));
    });
});
