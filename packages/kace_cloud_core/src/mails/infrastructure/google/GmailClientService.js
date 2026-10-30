import { gmail } from '@googleapis/gmail';
import { OAuth2Client } from 'google-auth-library';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class GmailClientService {
    /** @type {String} is initialized in the constructor*/
    #account;
    /** @type {String} is initialized in the constructor*/
    #fromName;

    /**
     * Creates an instance of the `GmailClientService` class.
     *
     * @param {MailAccount} mailAccount
     */
    constructor(mailAccount) {
        this.#account = mailAccount.from_address.value;
        this.#fromName = mailAccount.from_name?.value || '';
        this.oauth2Client = new OAuth2Client(mailAccount.client_id.value, mailAccount.client_secret.value);
        this.oauth2Client.setCredentials({ refresh_token: mailAccount.refresh_token.value });
    }

    /**
     * Returns the formatted sender string for the From header.
     * If a display name is configured, returns "Name <email>"; otherwise just the email.
     *
     * @returns {string}
     */
    get #fromHeader() {
        return this.#fromName ? `${this.#fromName} <${this.#account}>` : this.#account;
    }

    async getAccessToken() {
        const token = await this.oauth2Client.getAccessToken();
        return token.token;
    }

    async refreshAccessToken() {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        return credentials;
    }

    async sendMailUser(to, subject, body, cc = [], bcc = [], attachments = []) {
        await this.refreshAccessToken();
        return this.#sendMail('me', to, subject, body, cc, bcc, attachments);
    }

    async sendMailApplication(to, subject, body, cc = [], bcc = [], attachments = []) {
        await this.refreshAccessToken();
        return this.#sendMail(this.#account, to, subject, body, cc, bcc, attachments);
    }

    async #sendMailRequest(userId, encodedMessage) {
        const gmailClient = gmail({ version: 'v1', auth: this.oauth2Client });

        return gmailClient.users.messages.send({
            userId,
            requestBody: { raw: encodedMessage },
        });
    }

    async #sendMail(userId, to, subject, body, cc, bcc, attachments = []) {
        const message = this.createEmailMessage(to, subject, body, cc, bcc, attachments);
        const encodedMessage = this.#encodeMessage(message);

        try {
            const res = await this.#sendMailRequest(userId, encodedMessage);
            return res.data;
        } catch (error) {
            Helper.logError('Gmail API send failed', error);
            this.#handleError(error);
        }
    }

    createEmailMessage(to, subject, body, cc = [], bcc = [], attachments = []) {
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const normalizedTo = Array.isArray(to) ? to.join(', ') : to;
        const safeCc = Array.isArray(cc) ? cc : [];
        const safeBcc = Array.isArray(bcc) ? bcc : [];

        if (attachments?.length) {
            const boundary = `kace-boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            // Solo las líneas de header se filtran (para quitar los huecos de Cc/Bcc
            // ausentes); la línea en blanco que separa headers de cuerpo se agrega
            // aparte para que nunca la elimine el filter (ver nota más abajo).
            const headers = [
                `From: ${this.#fromHeader}`,
                `To: ${normalizedTo}`,
                safeCc.length > 0 ? `Cc: ${safeCc.join(', ')}` : '',
                safeBcc.length > 0 ? `Bcc: ${safeBcc.join(', ')}` : '',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
            ]
                .filter(Boolean)
                .concat('');

            const bodyPart = [
                `--${boundary}`,
                'Content-Type: text/html; charset=utf-8',
                'Content-Transfer-Encoding: 8bit',
                '',
                body,
                '',
            ];

            const attachmentParts = attachments.flatMap((attachment) => {
                const filename = this.#escapeMimeParameter(attachment.filename);
                // contentType puede venir de metadata externa (p. ej. S3); se sanea igual
                // que filename para que no pueda inyectar comillas/CRLF dentro del header MIME.
                const contentType = this.#escapeMimeParameter(attachment.contentType || 'application/octet-stream');
                return [
                    `--${boundary}`,
                    `Content-Type: ${contentType}; name="${filename}"`,
                    'Content-Transfer-Encoding: base64',
                    `Content-Disposition: attachment; filename="${filename}"`,
                    '',
                    Buffer.from(attachment.content).toString('base64'),
                    '',
                ];
            });

            // RFC 5322 exige CRLF entre líneas; un LF simple puede hacer que servidores
            // de correo estrictos (p. ej. Exchange) no logren separar headers de cuerpo
            // y muestren el mensaje crudo como texto plano.
            return [...headers, ...bodyPart, ...attachmentParts, `--${boundary}--`].join('\r\n').trim();
        }

        // Igual que arriba: si Cc/Bcc vienen vacíos, esas entradas condicionales son ''
        // y sin filtrarlas quedarían como líneas en blanco DENTRO del bloque de headers.
        // Por RFC 5322 la primera línea en blanco marca el fin de los headers, así que
        // ese hueco cortaría el mensaje ahí y dejaría Content-Type/Subject/body como
        // texto plano sin asunto (repro real: Gmail mostrando "(sin asunto)" con los
        // headers como texto crudo en el cuerpo).
        const headerLines = [
            `From: ${this.#fromHeader}`,
            `To: ${normalizedTo}`,
            safeCc.length > 0 ? `Cc: ${safeCc.join(', ')}` : '',
            safeBcc.length > 0 ? `Bcc: ${safeBcc.join(', ')}` : '',
            `Content-Type: text/html; charset=utf-8`,
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
        ].filter(Boolean);

        return [...headerLines, '', body].join('\r\n').trim();
    }

    #escapeMimeParameter(value) {
        return String(value ?? 'attachment').replace(/["\r\n]/g, '_');
    }

    #encodeMessage(message) {
        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    #handleError(error) {
        const status = error?.response?.status;
        // Gmail/Gaxios surfaces the real cause here (e.g. "Login Required.",
        // "Delegation denied", "insufficient permissions"). Preferir ese mensaje
        // en vez de una etiqueta genérica para que el log sea diagnosticable.
        const reason =
            error?.response?.data?.error?.message ||
            error?.response?.data?.error_description ||
            error?.message ||
            'unknown error';

        if (status === 401) {
            // 401 no siempre es "token expirado": con OAuth de usuario también
            // ocurre cuando el from_address/userId no está autorizado para esa cuenta.
            throw new Error(`Gmail authorization failed (401): ${reason}`);
        }
        throw new Error(`Error sending email${status ? ` (${status})` : ''}: ${reason}`);
    }
}
