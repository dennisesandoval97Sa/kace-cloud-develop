import { S3CreatePresignedUrl } from '../../../shared/infrastructure/aws/S3CreatePresignedUrl';

export class GetPresignedUrl {
    /** is initialized in the constructor */
    #s3Client;
    /** is initialized in the constructor */
    #command;

    constructor(s3Client, command) {
        this.#s3Client = s3Client;
        this.#command = command;
    }

    async execute() {
        const presignedUrl = new S3CreatePresignedUrl(this.#s3Client, this.#command);
        return presignedUrl.execute();
    }
}
