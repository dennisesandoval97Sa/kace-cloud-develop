import { ChannelHubInboundEmailProcessingResult } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessingResult.js';

describe('ChannelHubInboundEmailProcessingResult', () => {
    it('defaults code, message, data, and error to null when the constructor omits them', () => {
        const result = new ChannelHubInboundEmailProcessingResult({ status: 'accepted' });

        expect(result.code).toBeNull();
        expect(result.message).toBeNull();
        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });

    it('accepted() defaults data to null when no data is supplied', () => {
        const result = ChannelHubInboundEmailProcessingResult.accepted();

        expect(result.accepted).toBe(true);
        expect(result.data).toBeNull();
    });

    it('retryable() defaults error to null when no error is supplied', () => {
        const result = ChannelHubInboundEmailProcessingResult.retryable('processing_failed', 'boom');

        expect(result.retryable).toBe(true);
        expect(result.error).toBeNull();
    });

    it('alreadyProcessed() defaults data to null when no data is supplied', () => {
        const result = ChannelHubInboundEmailProcessingResult.alreadyProcessed();

        expect(result.alreadyProcessed).toBe(true);
        expect(result.data).toBeNull();
    });
});
