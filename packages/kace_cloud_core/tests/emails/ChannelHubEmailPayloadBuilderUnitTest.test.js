import { ChannelHubEmailPayloadBuilder } from '../../src/emails/infrastructure/mappers/ChannelHubEmailPayloadBuilder.js';

describe('ChannelHubEmailPayloadBuilder.buildSendPayload', () => {
    it('defaults recipient lists and attachments to empty when omitted entirely', () => {
        const payload = ChannelHubEmailPayloadBuilder.buildSendPayload({
            connectionId: 'conn-1',
            from: 'a@b.com',
            to: undefined,
            subject: 's',
            html: 'h',
        });

        expect(payload.to).toEqual([]);
        expect(payload.cc).toBeNull();
        expect(payload.bcc).toBeNull();
        expect(payload.attachments).toEqual([]);
    });

    it('keeps non-empty, filtered cc and bcc lists', () => {
        const payload = ChannelHubEmailPayloadBuilder.buildSendPayload({
            connectionId: 'conn-1',
            from: 'a@b.com',
            to: ['to@example.com'],
            cc: ['cc@example.com', '', 42],
            bcc: ['bcc@example.com'],
            subject: 's',
            html: 'h',
            attachments: ['att-1', null, 'att-2', undefined],
        });

        expect(payload.cc).toEqual(['cc@example.com']);
        expect(payload.bcc).toEqual(['bcc@example.com']);
        expect(payload.attachments).toEqual(['att-1', 'att-2']);
    });
});

describe('ChannelHubEmailPayloadBuilder.buildReplyPayload', () => {
    it('defaults attachments to an empty list when omitted', () => {
        const payload = ChannelHubEmailPayloadBuilder.buildReplyPayload({
            connectionId: 'conn-1',
            from: 'a@b.com',
            inReplyTo: 'msg-1',
            replyMessage: 'hi',
            isReplyAll: false,
            cc: [],
            bcc: [],
        });

        expect(payload.attachments).toEqual([]);
        expect(payload.cc).toBeNull();
        expect(payload.bcc).toBeNull();
    });

    it('preserves an explicit attachments array', () => {
        const payload = ChannelHubEmailPayloadBuilder.buildReplyPayload({
            connectionId: 'conn-1',
            from: 'a@b.com',
            inReplyTo: 'msg-1',
            replyMessage: 'hi',
            isReplyAll: true,
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com'],
            attachments: ['att-1'],
        });

        expect(payload.attachments).toEqual(['att-1']);
        expect(payload.cc).toEqual(['cc@example.com']);
        expect(payload.bcc).toEqual(['bcc@example.com']);
    });
});
