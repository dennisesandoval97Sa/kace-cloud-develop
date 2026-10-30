import { GmailClientService, MsGraphEmailService, SmtpEmailService } from '../../index.js';
import { Helper, MailAccountsTypes } from '../../../shared/index.js';
import { EmailSentStatusEnum } from '../../domain/enums/EmailSentStatusEnum.js';

export class EmailSender {
    /**
     * Creates an instance of the `MsGraphEmailService` class.
     * @param {Mail} mail
     * @param {MailAccount} mailAccount
     */
    constructor(mail, mailAccount) {
        this.mail = mail;
        this.serviceAccount = mailAccount;
        this.mailContent = mail.content.value;
        this.mailAttachments = mail.attachments?.value ?? [];
    }

    async send() {
        const sendMethods = {
            [MailAccountsTypes.MS_GRAPH_APPLICATION.value]: this.sendViaMsGraphApplication.bind(this),
            [MailAccountsTypes.MS_GRAPH_USER.value]: this.sendViaMsGraphUser.bind(this),
            [MailAccountsTypes.GMAIL_APPLICATION.value]: this.sendViaGmailApplication.bind(this),
            [MailAccountsTypes.GMAIL_USER.value]: this.sendViaGmailUser.bind(this),
            [MailAccountsTypes.SMTP.value]: this.sendViaSmtp.bind(this),
        };
        const sendMethod = sendMethods[this.serviceAccount.type.value];

        if (!sendMethod) {
            Helper.logError(`Service account type ${this.serviceAccount.type.value} not supported for send`);
            throw new Error('Service account type not supported for send');
        }

        Helper.logDebug(`Send email with account`, this.serviceAccount.toJson());
        return sendMethod();
    }

    async sendViaMsGraphUser() {
        const graphService = new MsGraphEmailService(this.serviceAccount);
        try {
            Helper.logDebug(`Sending email via MS Graph User...`);
            await graphService.sendEmailUser(
                this.mail.to.value,
                this.mail.subject.value,
                this.mailContent,
                this.mail.cc.value,
                this.mail.bcc.value,
                this.mailAttachments
            );
            Helper.logInfo(`Email sent successfully via MS Graph User`);
            return EmailSentStatusEnum.SENT.value;
        } catch (error) {
            Helper.logError(`Failed to send email via MS Graph User: `, error);
            return EmailSentStatusEnum.FAILED.value;
        }
    }

    async sendViaMsGraphApplication() {
        const graphService = new MsGraphEmailService(this.serviceAccount);
        try {
            Helper.logDebug(`Sending email via MS Graph Application...`);
            await graphService.sendEmail(
                this.mail.to.value,
                this.mail.subject.value,
                this.mailContent,
                this.mail.cc.value,
                this.mail.bcc.value,
                this.mailAttachments
            );
            Helper.logInfo(`Email sent successfully via MS Graph Application`);
            return EmailSentStatusEnum.SENT.value;
        } catch (error) {
            Helper.logError(`Failed to send email via MS Graph Application: `, error);
            return EmailSentStatusEnum.FAILED.value;
        }
    }

    async sendViaGmailUser() {
        const gmailService = new GmailClientService(this.serviceAccount);
        try {
            Helper.logDebug(`Sending email via Gmail User...`);
            await gmailService.sendMailUser(
                this.mail.to.value,
                this.mail.subject.value,
                this.mailContent,
                this.mail.cc.value,
                this.mail.bcc.value,
                this.mailAttachments
            );
            Helper.logInfo(`Email sent successfully via Gmail User`);
            return EmailSentStatusEnum.SENT.value;
        } catch (error) {
            Helper.logError(`Failed to send email via Gmail User: `, error);
            return EmailSentStatusEnum.FAILED.value;
        }
    }

    async sendViaGmailApplication() {
        const gmailService = new GmailClientService(this.serviceAccount);
        try {
            Helper.logDebug(`Sending email via Gmail Application...`);
            await gmailService.sendMailApplication(
                this.mail.to.value,
                this.mail.subject.value,
                this.mailContent,
                this.mail.cc.value,
                this.mail.bcc.value,
                this.mailAttachments
            );
            Helper.logInfo(`Email sent successfully via Gmail Application`);
            return EmailSentStatusEnum.SENT.value;
        } catch (error) {
            Helper.logError(`Failed to send email via Gmail Application: `, error);
            return EmailSentStatusEnum.FAILED.value;
        }
    }

    async sendViaSmtp() {
        const smtp = new SmtpEmailService(this.serviceAccount);

        try {
            Helper.logDebug(`Sending email via SMTP...`);
            const result = await smtp.sendEmail(
                this.mail.subject.value,
                this.mailContent,
                this.mail.to.value,
                this.mail.cc.value,
                this.mail.bcc.value,
                this.mailAttachments
            );
            if (!result.success) {
                throw new Error(result.error);
            }
            Helper.logInfo(`Email sent successfully via SMTP`);
            return EmailSentStatusEnum.SENT.value;
        } catch (error) {
            Helper.logError(`Failed to send email via SMTP: `, error);
            return EmailSentStatusEnum.FAILED.value;
        }
    }
}
