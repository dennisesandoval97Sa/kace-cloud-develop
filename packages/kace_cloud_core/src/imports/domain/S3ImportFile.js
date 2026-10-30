import { AggregateRoot, ValueObjectString, ValueObjectTimestamp } from '../../shared';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectFilePath } from './value-objects/ValueObjectFilePath';
import { ValueObjectShortString50 } from './value-objects/ValueObjectShortString50';
import { ValueObjectIntPositives } from '../../shared/domain/value-object/ValueObjectIntPositives';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean';

export class S3ImportFile extends AggregateRoot {
    /** @type {ValueObjectFilePath} is initialized in the constructor */
    #file_path;
    /** @type {ValueObjectShortString50} is initialized in the constructor */
    #status;
    /** @type {ValueObjectIntPositives } is initialized in the constructor */
    #upload_attempts;
    /** @type {ValueObjectIntPositives } is initialized in the constructor */
    #total_records;
    /** @type {ValueObjectIntPositives } is initialized in the constructor */
    #processed_records;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_updated_at;
    /** @type {ValueObjectString} is initialized in the constructor */
    #error_details;
    /** @type {ValueObjectShortString50} is initialized in the constructor */
    #target_table;
    /** @type {ValueObjectString} is initialized in the constructor */
    #action_type;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #should_override_array;

    constructor({
        id = uuidv4(),
        file_path,
        status = 'pending',
        upload_attempts = 0,
        total_records = 0,
        processed_records = 0,
        last_updated_at,
        created_at = new Date(),
        created_by,
        error_details,
        target_table,
        action_type,
        should_override_array = false,
    }) {
        super(id);
        this.#file_path = new ValueObjectFilePath(file_path);
        this.#status = new ValueObjectShortString50('status', status);
        this.#upload_attempts = new ValueObjectIntPositives('upload_attempts', upload_attempts);
        this.#total_records = new ValueObjectIntPositives('total_records', total_records);
        this.#processed_records = new ValueObjectIntPositives('processed_records', processed_records);
        this.#last_updated_at = new ValueObjectTimestamp('last_updated_at', last_updated_at, true);
        this.#error_details = new ValueObjectString('error_details', error_details, true);
        this.#target_table = new ValueObjectShortString50('target_table', target_table);
        this.#action_type = new ValueObjectString('action_type', action_type, true);
        this.#should_override_array = new ValueObjectBoolean('should_override_array', should_override_array ?? false);
        this.created_at = created_at;
        this.created_by = created_by;
    }

    static create(dto) {
        return new S3ImportFile(dto);
    }

    #formatErrors(errorString) {
        // Joi validation errors are joined with '; ', processing errors with ','
        const segments = errorString.split(/;\s+/);
        const errorArray = segments.flatMap((seg) => seg.split(',').map((e) => e.trim())).filter(Boolean);

        const formattedErrors = {
            generalErrors: [],
            insertErrors: [],
        };

        errorArray.forEach((error) => {
            const matchNew = error.match(
                /Error (insertando|eliminando) la fila (\d+)(?:\s*\(id:\s*([^)]+)\))?\s*:\s*(.+)/
            );
            const matchOld = error.match(/Error insertando el registro con id (\S+) por (.+)/);

            if (matchNew) {
                formattedErrors.insertErrors.push({
                    row_number: matchNew[2],
                    id_record: matchNew[3] ?? null,
                    error_detail: matchNew[4],
                });
            } else if (matchOld) {
                formattedErrors.insertErrors.push({
                    id_record: matchOld[1],
                    error_detail: matchOld[2],
                });
            } else {
                formattedErrors.generalErrors.push(error);
            }
        });

        return formattedErrors;
    }

    get file_path() {
        return this.#file_path;
    }

    set file_path(value) {
        if (this.#file_path.value !== value) {
            this.#file_path = new ValueObjectFilePath(value);
            this.changedAttributes.file_path = value;
        }
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        if (this.#status.value !== value) {
            this.#status = new ValueObjectShortString50(value);
            this.changedAttributes.status = value;
        }
    }

    get upload_attempts() {
        return this.#upload_attempts;
    }

    set upload_attempts(value) {
        if (this.#upload_attempts.value !== value) {
            this.#upload_attempts = new ValueObjectIntPositives('upload_attempts', value);
            this.changedAttributes.upload_attempts = value;
        }
    }

    get total_records() {
        return this.#total_records;
    }

    set total_records(value) {
        if (this.#total_records.value !== value) {
            this.#total_records = new ValueObjectIntPositives('total_records', value);
            this.changedAttributes.total_records = value;
        }
    }

    get processed_records() {
        return this.#processed_records;
    }

    set processed_records(value) {
        if (this.#processed_records.value !== value) {
            this.#processed_records = new ValueObjectIntPositives('processed_records', value);
            this.changedAttributes.processed_records = value;
        }
    }

    get last_updated_at() {
        return this.#last_updated_at;
    }

    set last_updated_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#last_updated_at.value !== value) {
            this.#last_updated_at = new ValueObjectTimestamp('last_updated_at', value);
            this.changedAttributes.last_updated_at = value;
        }
    }

    get error_details() {
        if (!this.#error_details.value) return this.#error_details;
        return { value: this.#formatErrors(this.#error_details.value) };
    }

    set error_details(value) {
        if (this.#error_details.value !== value) {
            this.#error_details = new ValueObjectString('error_details', value);
            this.changedAttributes.error_details = value;
        }
    }

    get target_table() {
        return this.#target_table;
    }

    set target_table(value) {
        if (this.#target_table.value !== value) {
            this.#target_table = new ValueObjectShortString50(value);
            this.changedAttributes.target_table = value;
        }
    }

    get action_type() {
        return this.#action_type;
    }

    set action_type(value) {
        if (this.#action_type.value !== value) {
            this.#action_type = new ValueObjectString('action_type', value, true);
            this.changedAttributes.action_type = value;
        }
    }

    get should_override_array() {
        return this.#should_override_array;
    }

    set should_override_array(value) {
        if (this.#should_override_array.value !== value) {
            this.#should_override_array = new ValueObjectBoolean('should_override_array', value);
            this.changedAttributes.should_override_array = value;
        }
    }
}
