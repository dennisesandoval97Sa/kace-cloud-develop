import { ChannelHubInboundEmailProcessor } from '../application/ChannelHubInboundEmailProcessor.js';
import { ChannelHubInboundAttachmentDownloader } from '../application/ChannelHubInboundAttachmentDownloader.js';
import { ChannelHubInboundTextBodyDownloader } from '../application/ChannelHubInboundTextBodyDownloader.js';
import {
    ChannelHubInlineImageEmbedder,
    MAX_INLINE_IMAGE_BYTES_TOTAL,
} from '../application/ChannelHubInlineImageEmbedder.js';
import { KnexEmailAttachmentRepository } from '../../emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { KnexEmailsBodyRepository } from '../../emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexEmailsRepository } from '../../emails/infrastructure/persistence/KnexEmailsRepository.js';
import { S3AttachmentStorage } from '../../emails/infrastructure/persistence/S3AttachmentStorage.js';
import { S3EmailBodyStorage } from '../../emails/infrastructure/persistence/S3EmailBodyStorage.js';
import { KnexInteractionRepository } from '../../interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { S3FileScanner, S3ScanService } from '../../s3-files/index.js';
import { KnexWorkspacesRepository } from '../../workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { KnexChannelHubAccountRepository } from '../../channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';

export function buildChannelHubInboundEmailProcessor(knexConfig) {
    const ownsConnection = typeof knexConfig !== 'function';
    const emailRepository = new KnexEmailsRepository(knexConfig);
    const emailBodyRepository = new KnexEmailsBodyRepository(emailRepository.connection);
    const emailAttachmentRepository = new KnexEmailAttachmentRepository(emailRepository.connection);
    const interactionRepository = new KnexInteractionRepository(emailRepository.connection);
    const channelHubAccountRepository = new KnexChannelHubAccountRepository(emailRepository.connection);
    const workspaceRepository = new KnexWorkspacesRepository(emailRepository.connection);
    const allowedConnectionRepository = {
        isAllowedConnection: (url) => emailRepository.isAllowedConnection(url),
    };
    const inlineImageDownloader = new ChannelHubInboundAttachmentDownloader({
        // The HTML body URL itself is still protected by Allowed Connections before this runs.
        // Inline images are embedded best-effort without requiring every third-party image host
        // referenced by that trusted HTML document to be configured as an Allowed Connection.
        maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
    });

    return {
        processor: new ChannelHubInboundEmailProcessor({
            emailRepository,
            emailBodyRepository,
            emailAttachmentRepository,
            interactionRepository,
            channelHubAccountRepository,
            workspaceRepository,
            allowedConnectionRepository,
            bodyDownloader: new ChannelHubInboundTextBodyDownloader({ allowedConnectionRepository }),
            attachmentDownloader: new ChannelHubInboundAttachmentDownloader({ allowedConnectionRepository }),
            attachmentStorage: new S3AttachmentStorage(),
            bodyStorage: new S3EmailBodyStorage(),
            fileScanner: new S3FileScanner(new S3ScanService()),
            inlineImageEmbedder: new ChannelHubInlineImageEmbedder({ downloader: inlineImageDownloader }),
        }),
        destroy: ownsConnection ? () => emailRepository.destroyConnection() : async () => {},
    };
}
