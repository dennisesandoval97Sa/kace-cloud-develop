export const emailConfig = {
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    from_address: process.env.GMAIL_ACCOUNT,
};

export const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;
