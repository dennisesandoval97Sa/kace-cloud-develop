export class ChannelHubInboundEmailProcessingResult {
    constructor({ status, code = null, message = null, data = null, error = null }) {
        this.status = status;
        this.code = code;
        this.message = message;
        this.data = data;
        this.error = error;
        this.accepted = status === 'accepted';
        this.retryable = status === 'retryable';
        this.nonRetryable = status === 'non_retryable';
        this.alreadyProcessed = code === 'already_processed' || status === 'already_processed';
    }

    static accepted(data = null) {
        return new ChannelHubInboundEmailProcessingResult({
            status: 'accepted',
            code: 'accepted',
            data,
        });
    }

    static nonRetryable(code, message) {
        return new ChannelHubInboundEmailProcessingResult({
            status: 'non_retryable',
            code,
            message,
        });
    }

    static retryable(code, message, error = null) {
        return new ChannelHubInboundEmailProcessingResult({
            status: 'retryable',
            code,
            message,
            error,
        });
    }

    static alreadyProcessed(data = null) {
        return new ChannelHubInboundEmailProcessingResult({
            status: 'accepted',
            code: 'already_processed',
            message: 'Channel Hub message was already processed.',
            data,
        });
    }
}
