export const emailConfig = {
    client_id: process.env.MSGRAPH_CLIENT_ID,
    client_secret: process.env.MSGRAPH_CLIENT_SECRET,
    tenant_id: process.env.MSGRAPH_TENANT_ID,
    from_address: process.env.MSGRAPH_ACCOUNT,
};

export const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;
