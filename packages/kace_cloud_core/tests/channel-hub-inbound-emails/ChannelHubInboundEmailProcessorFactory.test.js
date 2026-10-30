import { jest } from '@jest/globals';

const MAX_INLINE_IMAGE_BYTES_TOTAL = 4 * 1024 * 1024;

const processorCtor = jest.fn(function ChannelHubInboundEmailProcessor(options) {
    this.options = options;
});
const attachmentDownloaderCtor = jest.fn(function ChannelHubInboundAttachmentDownloader(options) {
    this.options = options;
});
const textBodyDownloaderCtor = jest.fn(function ChannelHubInboundTextBodyDownloader(options) {
    this.options = options;
});
const inlineImageEmbedderCtor = jest.fn(function ChannelHubInlineImageEmbedder(options) {
    this.options = options;
});
const emailRepositoryCtor = jest.fn(function KnexEmailsRepository(knexConfig) {
    this.knexConfig = knexConfig;
    this.connection = { id: 'shared-knex-connection' };
    this.destroyConnection = jest.fn().mockResolvedValue(undefined);
    this.isAllowedConnection = jest.fn();
});
const emailBodyRepositoryCtor = jest.fn(function KnexEmailsBodyRepository(connection) {
    this.connection = connection;
});
const emailAttachmentRepositoryCtor = jest.fn(function KnexEmailAttachmentRepository(connection) {
    this.connection = connection;
});
const interactionRepositoryCtor = jest.fn(function KnexInteractionRepository(connection) {
    this.connection = connection;
});
const channelHubAccountRepositoryCtor = jest.fn(function KnexChannelHubAccountRepository(connection) {
    this.connection = connection;
});
const workspaceRepositoryCtor = jest.fn(function KnexWorkspacesRepository(connection) {
    this.connection = connection;
});
const attachmentStorageCtor = jest.fn(function S3AttachmentStorage() {});
const scanServiceCtor = jest.fn(function S3ScanService() {});
const fileScannerCtor = jest.fn(function S3FileScanner(scanService) {
    this.scanService = scanService;
});

jest.unstable_mockModule('../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js', () => ({
    ChannelHubInboundEmailProcessor: processorCtor,
}));
jest.unstable_mockModule(
    '../../src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js',
    () => ({ ChannelHubInboundAttachmentDownloader: attachmentDownloaderCtor })
);
jest.unstable_mockModule(
    '../../src/channel-hub-inbound-emails/application/ChannelHubInboundTextBodyDownloader.js',
    () => ({ ChannelHubInboundTextBodyDownloader: textBodyDownloaderCtor })
);
jest.unstable_mockModule('../../src/channel-hub-inbound-emails/application/ChannelHubInlineImageEmbedder.js', () => ({
    ChannelHubInlineImageEmbedder: inlineImageEmbedderCtor,
    MAX_INLINE_IMAGE_BYTES_TOTAL,
}));
jest.unstable_mockModule('../../src/emails/infrastructure/persistence/KnexEmailsRepository.js', () => ({
    KnexEmailsRepository: emailRepositoryCtor,
}));
jest.unstable_mockModule('../../src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js', () => ({
    KnexEmailsBodyRepository: emailBodyRepositoryCtor,
}));
jest.unstable_mockModule('../../src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js', () => ({
    KnexEmailAttachmentRepository: emailAttachmentRepositoryCtor,
}));
jest.unstable_mockModule('../../src/emails/infrastructure/persistence/S3AttachmentStorage.js', () => ({
    S3AttachmentStorage: attachmentStorageCtor,
}));
jest.unstable_mockModule('../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js', () => ({
    KnexInteractionRepository: interactionRepositoryCtor,
}));
jest.unstable_mockModule('../../src/s3-files/index.js', () => ({
    S3FileScanner: fileScannerCtor,
    S3ScanService: scanServiceCtor,
}));
jest.unstable_mockModule('../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js', () => ({
    KnexWorkspacesRepository: workspaceRepositoryCtor,
}));
jest.unstable_mockModule(
    '../../src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js',
    () => ({
        KnexChannelHubAccountRepository: channelHubAccountRepositoryCtor,
    })
);

const { buildChannelHubInboundEmailProcessor } =
    await import('../../src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js');

describe('ChannelHubInboundEmailProcessorFactory', () => {
    beforeEach(() => {
        processorCtor.mockClear();
        attachmentDownloaderCtor.mockClear();
        textBodyDownloaderCtor.mockClear();
        inlineImageEmbedderCtor.mockClear();
        emailRepositoryCtor.mockClear();
        emailBodyRepositoryCtor.mockClear();
        emailAttachmentRepositoryCtor.mockClear();
        interactionRepositoryCtor.mockClear();
        channelHubAccountRepositoryCtor.mockClear();
        workspaceRepositoryCtor.mockClear();
        attachmentStorageCtor.mockClear();
        scanServiceCtor.mockClear();
        fileScannerCtor.mockClear();
    });

    it('bypasses allowed connections only for inline image embedding downloads', () => {
        const { processor } = buildChannelHubInboundEmailProcessor({ client: 'pg' });

        expect(processor).toBe(processorCtor.mock.instances[0]);
        expect(attachmentDownloaderCtor).toHaveBeenCalledTimes(2);

        expect(attachmentDownloaderCtor.mock.calls[0][0]).toEqual({
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
        expect(attachmentDownloaderCtor.mock.calls[0][0]).not.toHaveProperty('allowedConnectionRepository');

        const allowedConnectionRepository = textBodyDownloaderCtor.mock.calls[0][0].allowedConnectionRepository;
        expect(textBodyDownloaderCtor).toHaveBeenCalledWith({ allowedConnectionRepository });
        expect(attachmentDownloaderCtor.mock.calls[1][0]).toEqual({ allowedConnectionRepository });

        expect(inlineImageEmbedderCtor).toHaveBeenCalledWith({
            downloader: attachmentDownloaderCtor.mock.instances[0],
        });
        expect(processorCtor).toHaveBeenCalledWith(
            expect.objectContaining({
                bodyDownloader: textBodyDownloaderCtor.mock.instances[0],
                attachmentDownloader: attachmentDownloaderCtor.mock.instances[1],
                inlineImageEmbedder: inlineImageEmbedderCtor.mock.instances[0],
            })
        );
    });

    it('destroys the owned connection when knexConfig is a plain config object', async () => {
        const { destroy } = buildChannelHubInboundEmailProcessor({ client: 'pg' });
        const emailRepositoryInstance = emailRepositoryCtor.mock.instances[0];

        await destroy();

        expect(emailRepositoryInstance.destroyConnection).toHaveBeenCalledTimes(1);
    });

    it('does not destroy the connection when knexConfig is a shared connection-provider function', async () => {
        const sharedKnexConfigFn = () => ({ client: 'pg' });

        const { destroy } = buildChannelHubInboundEmailProcessor(sharedKnexConfigFn);
        const emailRepositoryInstance = emailRepositoryCtor.mock.instances[0];

        await destroy();

        expect(emailRepositoryInstance.destroyConnection).not.toHaveBeenCalled();
    });
});
