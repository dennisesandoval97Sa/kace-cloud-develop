import nodemailer from 'nodemailer';

export async function sendAlert({ smtp, recipients, subject, body }) {
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.password,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: smtp.from,
            to: recipients.join(','),
            subject,
            text: body,
        });
        return { messageId: info.messageId };
    } finally {
        transporter.close();
    }
}
