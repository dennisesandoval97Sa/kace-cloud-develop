import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { Parameters } from '../../../shared/domain/params/Parameters.js';

export class MsGraphEmailService {
    /** @type {Client} is initialized in the constructor */
    #graphClient;
    /** @type {String} is initialized in the constructor */
    #account;

    /**
     * Creates an instance of the `MsGraphEmailService` class.
     *
     * @param {MailAccount} mailAccount
     */
    constructor(mailAccount) {
        this.#account = mailAccount.from_address.value;
        this.client = new ConfidentialClientApplication({
            auth: {
                clientId: mailAccount.client_id.value,
                authority: Parameters.mailAuthorityUrl(mailAccount.tenant_id.value),
                clientSecret: mailAccount.client_secret.value,
            },
        });
        this.#graphClient = null;
    }

    /**
     * Retrieves an access token from Microsoft Graph using client credentials.
     * @returns {Promise<string>} A promise that resolves to the access token.
     * @throws {Error} Throws an error if obtaining the token fails.
     */
    async getToken() {
        const tokenRequest = {
            scopes: [Parameters.mailAuthScope],
        };

        try {
            const response = await this.client.acquireTokenByClientCredential(tokenRequest);
            return response.accessToken;
        } catch (error) {
            Helper.logError(error);
            throw new Error(`Error obtaining the token: ${error.message}`);
        }
    }

    async getGraphClient() {
        if (!this.#graphClient) {
            const accessToken = await this.getToken();
            this.#graphClient = Client.init({
                authProvider: (done) => {
                    done(null, accessToken);
                },
            });
        }
        return this.#graphClient;
    }

    /**
     * Creates the mail object structure.
     * @param {Array} to
     * @param {String} subject
     * @param {String} body
     * @param {Array} cc
     * @param {Array} bcc
     * @returns {Object} The mail object.
     */
    createMailObject(to, subject, body, cc = [], bcc = [], attachments = []) {
        let mapEmail = (email) => ({
            emailAddress: {
                address: email,
            },
        });
        const message = {
            subject: subject,
            body: {
                contentType: 'html',
                content: body,
            },
            toRecipients: to.map(mapEmail),
        };

        if (cc && cc.length) {
            message.ccRecipients = cc.map(mapEmail);
        }

        if (bcc && bcc.length) {
            message.bccRecipients = bcc.map(mapEmail);
        }

        if (attachments?.length) {
            message.attachments = attachments.map((attachment) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: attachment.filename,
                contentType: attachment.contentType || 'application/octet-stream',
                contentBytes: Buffer.from(attachment.content).toString('base64'),
            }));
        }

        return { message };
    }

    async sendEmail(to, subject, body, cc = [], bcc = [], attachments = []) {
        const mail = this.createMailObject(to, subject, body, cc, bcc, attachments);

        try {
            const client = await this.getGraphClient();
            await client.api(`/users/${this.#account}/sendMail`).post(mail);
        } catch (error) {
            Helper.logInfo(error);
            throw new Error(`Error sending email: ${error.message}`);
        }
    }

    async sendEmailUser(to, subject, body, cc = [], bcc = [], attachments = []) {
        const mail = this.createMailObject(to, subject, body, cc, bcc, attachments);

        try {
            const client = await this.getGraphClient();
            await client.api(`/me/sendMail`).post(mail);
        } catch (error) {
            Helper.logInfo(error);
            throw new Error(`Error sending email: ${error.message}`);
        }
    }
}
