import { MailAccountSecretResolver } from '../../mail-accounts/domain/MailAccountSecretResolver.js';
import { Helper } from '../../shared/index.js';
import { EmailSender } from './sender/EmailSender.js';

export class EmailService {
    constructor(secretsRepository) {
        this.secretResolver = new MailAccountSecretResolver(secretsRepository);
    }

    async execute(mail, mailAccount) {
        try {
            if (this.secretResolver.hasSecrets(mailAccount)) {
                await this.secretResolver.resolve(mailAccount);
            }

            const sender = new EmailSender(mail, mailAccount);
            return await sender.send();
        } catch (error) {
            Helper.logError('Error in EmailService.execute:', error);
            throw error;
        }
    }
}
