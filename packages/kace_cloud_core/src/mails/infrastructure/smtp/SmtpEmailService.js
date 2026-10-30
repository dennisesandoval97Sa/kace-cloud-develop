import nodemailer from 'nodemailer';
import { Helper, TenantContext } from '../../../shared';

export class SmtpEmailService {
    /**
     * Creates an instance of the `SmtpMailer` class.
     *
     * @param {MailAccount} mailAccount
     */
    constructor(mailAccount) {
        this.mailAccount = mailAccount;

        const config = {
            host: this.mailAccount.host.value,
            port: this.mailAccount.port.value ?? 465,
            secure: this.mailAccount.encryption.value === 'ssl',

            auth: {
                user: this.mailAccount.username.value,
                pass: this.mailAccount.password.value,
            },
        };
        Helper.logDebug('SMTP Config:', { host: config.host, port: config.port, secure: config.secure });
        if (TenantContext.getTenant().apps_environment.value === 'development') {
            config['tls'] = {
                rejectUnauthorized: false,
            };
        }
        this.transporter = nodemailer.createTransport(config);
    }

    /**
     * Sends an email.
     *
     * @param {Object} options - Email options
     * @param {string} options.subject - Email subject
     * @param {string} options.body - Email body (HTML)
     * @param {string[]} options.to - Recipients
     * @param {string[]} [options.cc] - CC recipients
     * @param {string[]} [options.bcc] - BCC recipients
     * @returns {Promise<Object>} - Result of the email sending operation
     */
    async sendEmail(subject, body, to, cc = [], bcc = [], attachments = []) {
        try {
            const mailOptions = this.createMailOptions(subject, body, to, cc, bcc, attachments);
            const result = await this.transporter.sendMail(mailOptions);
            Helper.logDebug(`Email sent via SMTP: `, result);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            Helper.logError(`Error sending email via SMTP: `, error);
            return { success: false, error: error.message };
        }
    }

    createMailOptions(subject, body, to, cc = [], bcc = [], attachments = []) {
        return {
            from: `${this.mailAccount.from_name.value} <${this.mailAccount.from_address.value}>`,
            to: (to ?? []).join(', '),
            cc: (cc ?? []).join(', '),
            bcc: (bcc ?? []).join(', '),
            subject: subject,
            html: body,
            attachments,
        };
    }
}
