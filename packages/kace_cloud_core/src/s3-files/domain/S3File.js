import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription, ValueObjectTimestamp } from '../../shared';
import {
    ValueObjectFileName,
    ValueObjectOrigin,
    ValueObjectS3FileName,
    ValueObjectSize,
    ValueObjectURL,
} from './value-objects';

export class S3File extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectFileName} is initialized in the constructor */
    #file_name;
    /** @type {ValueObjectS3FileName} is initialized in the constructor */
    #s3_file_name;
    /** @type {ValueObjectURL} is initialized in the constructor */
    #url;
    /** @type {ValueObjectSize} is initialized in the constructor */
    #size;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #expired_at;
    /** @type {ValueObjectOrigin} is initialized in the constructor */
    #origin;

    constructor({
        id,
        description,
        file_name,
        s3_file_name,
        url,
        size,
        is_active,
        origin,
        created_at,
        updated_at,
        expired_at,
        created_by,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#file_name = new ValueObjectFileName(file_name ?? 'default');
        this.#s3_file_name = new ValueObjectS3FileName(s3_file_name ?? 'default');
        this.#url = new ValueObjectURL(url ?? 'default');
        this.#size = new ValueObjectSize(size ?? 1);
        this.#expired_at = new ValueObjectTimestamp('expired_at', expired_at ?? new Date());
        this.#origin = new ValueObjectOrigin('origin', origin ?? 'default');
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    get file_name() {
        return this.#file_name;
    }

    set file_name(value) {
        if (this.#file_name.value !== value) {
            this.#file_name = new ValueObjectFileName(value);
            this.changedAttributes.file_name = value;
        }
    }

    get s3_file_name() {
        return this.#s3_file_name;
    }

    set s3_file_name(value) {
        if (this.#s3_file_name.value !== value) {
            this.#s3_file_name = new ValueObjectS3FileName(value);
            this.changedAttributes.s3_file_name = value;
        }
    }

    get url() {
        return this.#url;
    }

    set url(value) {
        if (this.#url.value !== value) {
            this.#url = new ValueObjectURL(value);
            this.changedAttributes.url = value;
        }
    }

    get size() {
        return this.#size;
    }

    set size(value) {
        if (this.#size.value !== value) {
            this.#size = new ValueObjectSize(value);
            this.changedAttributes.size = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    get expired_at() {
        return this.#expired_at;
    }

    set expired_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#expired_at.value !== value) {
            this.#expired_at = new ValueObjectTimestamp('expired_at', value);
            this.changedAttributes.expired_at = value;
        }
    }

    get origin() {
        return this.#origin;
    }

    set origin(value) {
        if (this.#origin.value !== value) {
            this.#origin = new ValueObjectOrigin('origin', value);
            this.changedAttributes.origin = value;
        }
    }

    /**
     * Creates a new S3File object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the S3File object.
     * @returns {S3File} A new instance of the S3File class.
     */
    static create(dto) {
        return new S3File(dto);
    }
}
