export const emailConfig = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    encryption: process.env.SMTP_ENCRYPTION,
    username: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from_address: process.env.SMTP_EMAIL,
};

export const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;
