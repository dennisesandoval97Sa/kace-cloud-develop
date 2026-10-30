import { jest } from '@jest/globals';

/**
 * Mocks 'nodemailer' so tests never open a real SMTP connection.
 *
 * Reflects the real usage in src/mails/infrastructure/smtp/SmtpEmailService.js:
 * `nodemailer.createTransport(config)` returns a transporter, and the service later calls
 * `transporter.sendMail(mailOptions)`.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { createTransport, transporter, calls } = await mockSmtp();
 * const { SmtpEmailService } = await import('../../src/mails/infrastructure/smtp/SmtpEmailService.js');
 * transporter.sendMail.mockResolvedValue({ messageId: 'msg-1' });
 * // ...call code under test...
 * expect(calls.createTransport[0]).toMatchObject({ host: 'smtp.example.com' });
 * expect(calls.sendMail[0]).toMatchObject({ subject: 'Subject' });
 *
 * @returns {{
 *   createTransport: import('@jest/globals').jest.Mock,
 *   transporter: { sendMail: import('@jest/globals').jest.Mock },
 *   calls: { createTransport: object[], sendMail: object[] },
 * }}
 */
export const mockSmtp = () => {
    const calls = { createTransport: [], sendMail: [] };

    const transporter = {
        sendMail: jest.fn((mailOptions) => {
            calls.sendMail.push(mailOptions);
            return Promise.resolve({ messageId: 'mock-message-id' });
        }),
    };

    const createTransport = jest.fn((config) => {
        calls.createTransport.push(config);
        return transporter;
    });

    jest.unstable_mockModule('nodemailer', () => ({
        default: { createTransport },
        createTransport,
    }));

    return { createTransport, transporter, calls };
};
