import { v4 as uuidv4 } from 'uuid';
import { S3File } from '../../../src/s3-files';

export default class S3FileMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `S3File` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing the properties for an `S3File` entity.
     */
    static dto({
        id,
        description,
        object_name,
        url,
        size,
        is_active,
        expired_at,
        name_s3_file,
        origin,
        created_by,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            description: description ?? 'default_description',
            file_name: object_name ?? 'default_file_name',
            s3_file_name: name_s3_file ?? 'default_s3_file_name',
            url: url ?? 'https://example.com/default-url',
            size: size ?? 1,
            is_active: is_active ?? true,
            expired_at: expired_at ?? new Date().toISOString(),
            origin: origin ?? 'default_origin',
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates an `S3File` instance and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `S3File` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {S3File} The created `S3File` instance.
     */
    static async createS3File(repository, data = {}) {
        const s3File = S3File.create(S3FileMother.dto(data));
        await repository.save(s3File);
        return s3File;
    }
}
