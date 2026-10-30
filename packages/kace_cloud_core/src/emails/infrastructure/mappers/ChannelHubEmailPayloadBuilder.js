const filterEmails = (list) => (list ?? []).filter((e) => typeof e === 'string' && e.trim() !== '');

export class ChannelHubEmailPayloadBuilder {
    static buildSendPayload({ connectionId, from, to, cc, bcc, subject, html, attachments }) {
        const filteredCc = filterEmails(cc);
        const filteredBcc = filterEmails(bcc);
        return {
            connectionId,
            from,
            to: filterEmails(to),
            cc: filteredCc.length > 0 ? filteredCc : null,
            bcc: filteredBcc.length > 0 ? filteredBcc : null,
            subject,
            html,
            attachments: (attachments ?? []).filter(Boolean),
        };
    }

    static buildReplyPayload({ connectionId, from, inReplyTo, replyMessage, isReplyAll, cc, bcc, attachments }) {
        const filteredCc = filterEmails(cc);
        const filteredBcc = filterEmails(bcc);
        return {
            connectionId,
            from,
            responseMessageId: inReplyTo,
            replyMessage,
            isReplyAll,
            cc: filteredCc.length > 0 ? filteredCc : null,
            bcc: filteredBcc.length > 0 ? filteredBcc : null,
            attachments: attachments ?? [],
        };
    }
}
