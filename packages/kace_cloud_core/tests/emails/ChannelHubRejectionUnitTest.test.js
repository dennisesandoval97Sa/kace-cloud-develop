import { CHANNEL_HUB_SEND_REJECTED } from '@kace/error-codes';
import {
    MAX_PUBLIC_DETAIL_LENGTH,
    channelHubRejectionError,
    isChannelHubRejection,
} from '../../src/emails/domain/services/ChannelHubRejection.js';

function problem(overrides = {}) {
    return {
        type: 'urn:problem:bad-request',
        title: 'Bad Request',
        detail: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
        status: 400,
        instance: '/tst/v1/channel/email',
        ...overrides,
    };
}

describe('isChannelHubRejection', () => {
    it('recognises a 4xx problem+json', () => {
        expect(isChannelHubRejection(problem())).toBe(true);
        expect(isChannelHubRejection(problem({ status: 404 }))).toBe(true);
        expect(isChannelHubRejection(problem({ status: 499 }))).toBe(true);
    });

    it('ignores 5xx so a provider outage keeps its upstream semantics', () => {
        expect(isChannelHubRejection(problem({ status: 500 }))).toBe(false);
        expect(isChannelHubRejection(problem({ status: 503 }))).toBe(false);
    });

    it('ignores anything that is not a 4xx problem+json', () => {
        expect(isChannelHubRejection(problem({ status: 399 }))).toBe(false);
        expect(isChannelHubRejection(problem({ status: 200 }))).toBe(false);
        expect(isChannelHubRejection(problem({ status: '400' }))).toBe(false);
        expect(isChannelHubRejection(problem({ detail: '' }))).toBe(false);
        expect(isChannelHubRejection(problem({ detail: undefined }))).toBe(false);
        expect(isChannelHubRejection({ messageId: 'abc' })).toBe(false);
        expect(isChannelHubRejection(null)).toBe(false);
        expect(isChannelHubRejection(undefined)).toBe(false);
    });
});

describe('channelHubRejectionError', () => {
    it('carries the detail, a 400 and the public code', () => {
        const error = channelHubRejectionError(problem(), CHANNEL_HUB_SEND_REJECTED);

        expect(error.message).toBe('Operator account is not healthy: Microsoft: InvalidAuthenticationToken.');
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(CHANNEL_HUB_SEND_REJECTED);
    });

    it('truncates the third-party detail so no caller can republish arbitrary provider text', () => {
        const error = channelHubRejectionError(
            problem({ detail: 'x'.repeat(MAX_PUBLIC_DETAIL_LENGTH + 500) }),
            CHANNEL_HUB_SEND_REJECTED
        );

        expect(error.message).toHaveLength(MAX_PUBLIC_DETAIL_LENGTH);
    });
});
