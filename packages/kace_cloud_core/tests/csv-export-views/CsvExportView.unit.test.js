import { CsvExportView, CsvExportViewCollectionResponse, CsvExportViewResponse } from '../../src/csv-export-views';
import { v4 as uuidV4 } from 'uuid';
import CsvExportViewMother from './domain/CsvExportViewMother';
import { DeleteFieldsDoNotExistError, ValidationFailError } from '../../src/shared/index.js';
import { ValueObjectCsvFormatting } from '../../src/csv-export-views/domain/value-objects/index.js';

describe('CsvExportView Entity', () => {
    const dto = CsvExportViewMother.dto();

    it('should create a CsvExportView with valid data', () => {
        const csvExportView = CsvExportView.create(dto);

        expect(csvExportView.id.value).toBe(dto.id);
        expect(csvExportView.description.value).toBe(dto.description);
        expect(csvExportView.is_active.value).toBe(dto.is_active);
        expect(csvExportView.views.value).toEqual(dto.views);
        expect(csvExportView.frequency.value).toBe(dto.frequency);
        expect(csvExportView.interval.value).toBe(dto.interval);
        expect(csvExportView.time_filter.value).toBe(dto.time_filter);
        expect(csvExportView.storage_path.value).toBe(dto.storage_path);
        expect(csvExportView.last_execution_at.value).toBe(dto.last_execution_at);
        expect(csvExportView.details.value).toEqual(dto.details);
        expect(csvExportView.next_execution_at.value).toBe(dto.next_execution_at);
    });

    it('should update CsvExportView data', () => {
        const csvExportView = CsvExportView.create(dto);
        const newDescription = 'Updated Export Description';
        const newData = {
            description: newDescription,
            views: ['view3', 'view4'],
            frequency: 'weeks',
            interval: 2,
            time_filter: {
                field: 'created_at',
                interval: '12',
                unit: 'hours',
                reference: 'now',
            },
            storage_path: 'new/path/to/csv',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        csvExportView.update(newData);

        expect(csvExportView.description.value).toBe(newDescription);
        expect(csvExportView.views.value).toEqual(newData.views);
        expect(csvExportView.frequency.value).toBe(newData.frequency);
        expect(csvExportView.interval.value).toBe(newData.interval);
        expect(csvExportView.time_filter.value).toBe(newData.time_filter);
        expect(csvExportView.storage_path.value).toBe(newData.storage_path);
        expect(csvExportView.changedAttributes).toEqual({
            description: newDescription,
            views: JSON.stringify(newData.views),
            frequency: newData.frequency,
            interval: newData.interval,
            time_filter: newData.time_filter,
            storage_path: newData.storage_path,
            updated_at: newData.updated_at,
            updated_by: newData.updated_by,
        });
    });

    it('does not update properties when values are the same', () => {
        const csvExportView = CsvExportView.create(dto);
        const sameData = { ...dto };

        csvExportView.update(sameData);

        expect(csvExportView.changedAttributes).toEqual({});
    });

    it('marks a CsvExportView instance as deleted', () => {
        const csvExportView = CsvExportView.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };
        csvExportView.delete(deleteDto);

        expect(csvExportView.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(csvExportView.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const csvExportView = CsvExportView.create(dto);
        const deleteDto = {};

        expect(() => csvExportView.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should convert CsvExportView instance to JSON', () => {
        const csvExportView = CsvExportView.create(dto);

        const jsonResponse = csvExportView.toJson();

        expect(jsonResponse).toEqual({
            id: csvExportView.id.value,
            description: csvExportView.description.value,
            is_active: csvExportView.is_active.value,
            views: csvExportView.views.value,
            frequency: csvExportView.frequency.value,
            interval: csvExportView.interval.value,
            time_filter: csvExportView.time_filter.value,
            storage_path: csvExportView.storage_path.value,
            last_execution_at: csvExportView.last_execution_at.value,
            details: csvExportView.details.value,
            next_execution_at: csvExportView.next_execution_at.value,
            created_at: csvExportView.created_at.value,
            created_by: csvExportView.created_by.value,
            updated_at: csvExportView.updated_at.value,
            updated_by: csvExportView.updated_by.value,
        });
    });

    it('flushes changes in CsvExportView instance', () => {
        const csvExportView = CsvExportView.create(dto);
        const updateDto = {
            description: 'Updated Description',
            views: ['view3', 'view4'],
            frequency: 'weeks',
            interval: 2,
            time_filter: {
                field: 'created_at',
                interval: '12',
                unit: 'hours',
                reference: 'now',
            },
            storage_path: 'new/path/to/csv',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };
        csvExportView.update(updateDto);
        csvExportView.flushChanges();

        expect(csvExportView.changedAttributes).toEqual({});
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => CsvExportView.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
});

describe('CsvExportView Entity — constructor nullish-coalescing defaults', () => {
    // CsvExportViewMother always supplies these fields explicitly, so the `?? <default>` fallback
    // in the constructor is only exercised by omitting the field from the DTO entirely.
    const dtoWithout = (...keys) => {
        const dto = CsvExportViewMother.dto();
        keys.forEach((key) => delete dto[key]);
        return dto;
    };

    it('defaults description to "default" when omitted', () => {
        const csvExportView = CsvExportView.create(dtoWithout('description'));
        expect(csvExportView.description.value).toBe('default');
    });

    it('defaults is_active to false when omitted', () => {
        const csvExportView = CsvExportView.create(dtoWithout('is_active'));
        expect(csvExportView.is_active.value).toBe(false);
    });

    it('defaults views to ["default"] when omitted', () => {
        const csvExportView = CsvExportView.create(dtoWithout('views'));
        expect(csvExportView.views.value).toEqual(['default']);
    });

    it('defaults interval to 1 when omitted', () => {
        const csvExportView = CsvExportView.create(dtoWithout('interval'));
        expect(csvExportView.interval.value).toBe(1);
    });

    it('defaults next_execution_at to "now" when omitted', () => {
        const before = Date.now();
        const csvExportView = CsvExportView.create(dtoWithout('next_execution_at'));
        const after = Date.now();

        const nextExecutionMs = new Date(csvExportView.next_execution_at.value).getTime();
        expect(nextExecutionMs).toBeGreaterThanOrEqual(before);
        expect(nextExecutionMs).toBeLessThanOrEqual(after);
    });
});

describe('CsvExportView Entity — setters invoked directly (not via update())', () => {
    // AggregateRoot#update() short-circuits and never calls a property setter at all when the
    // incoming value already equals the current one, so the setters' own "value unchanged, skip"
    // branch can only be exercised by assigning the property directly.
    const dto = CsvExportViewMother.dto();

    it('is_active setter changes the value and records it, then is a no-op for the same value', () => {
        const csvExportView = CsvExportView.create(dto);
        const original = csvExportView.is_active.value;

        csvExportView.is_active = !original;
        expect(csvExportView.is_active.value).toBe(!original);
        expect(csvExportView.changedAttributes.is_active).toBe(!original);

        delete csvExportView.changedAttributes.is_active;
        csvExportView.is_active = !original;
        expect(csvExportView.changedAttributes).not.toHaveProperty('is_active');
    });

    it('details setter changes the value and records it, then is a no-op for the same value', () => {
        const csvExportView = CsvExportView.create(dto);
        const expectedStoredValue = {
            note: 'first',
            formatting: ValueObjectCsvFormatting.DEFAULT_VALUES,
        };

        csvExportView.details = { note: 'first' };
        expect(csvExportView.details.value).toEqual(expectedStoredValue);
        // #validateStructure() mutates the same object reference in place (json.formatting = ...),
        // and the setter stores that same reference on changedAttributes, so it picks up the
        // formatting default too rather than staying as the plain `{ note: 'first' }` that was
        // assigned — a shared-mutation quirk worth knowing about, not a behavior this test invented.
        expect(csvExportView.changedAttributes.details).toEqual(expectedStoredValue);

        delete csvExportView.changedAttributes.details;
        // The setter compares by reference (`!==` on an object), so a *new* plain object with the
        // same shape would NOT be treated as a no-op here — only re-assigning the exact stored
        // reference is.
        csvExportView.details = csvExportView.details.value;
        expect(csvExportView.changedAttributes).not.toHaveProperty('details');
    });

    it('last_execution_at setter is a no-op when assigned its current value', () => {
        const csvExportView = CsvExportView.create(dto);
        const iso = new Date().toISOString();

        csvExportView.last_execution_at = iso;
        expect(csvExportView.changedAttributes.last_execution_at).toBe(iso);

        delete csvExportView.changedAttributes.last_execution_at;
        csvExportView.last_execution_at = iso;
        expect(csvExportView.changedAttributes).not.toHaveProperty('last_execution_at');
    });

    it('next_execution_at setter changes the value and records it, then is a no-op for the same value', () => {
        const csvExportView = CsvExportView.create(dto);
        const newValue = new Date(Date.now() + 60_000).toISOString();

        csvExportView.next_execution_at = newValue;
        expect(csvExportView.next_execution_at.value).toBe(newValue);
        expect(csvExportView.changedAttributes.next_execution_at).toBe(newValue);

        delete csvExportView.changedAttributes.next_execution_at;
        csvExportView.next_execution_at = newValue;
        expect(csvExportView.changedAttributes).not.toHaveProperty('next_execution_at');
    });

    it('isActive() reflects the boolean value of is_active', () => {
        const activeView = CsvExportView.create({ ...dto, is_active: true });
        const inactiveView = CsvExportView.create({ ...dto, is_active: false });

        expect(activeView.isActive()).toBe(true);
        expect(inactiveView.isActive()).toBe(false);
    });

    it('description/views/frequency/interval/time_filter/storage_path setters are no-ops for their current value', () => {
        const csvExportView = CsvExportView.create(dto);

        csvExportView.description = csvExportView.description.value;
        csvExportView.views = csvExportView.views.value;
        csvExportView.frequency = csvExportView.frequency.value;
        csvExportView.interval = csvExportView.interval.value;
        csvExportView.time_filter = csvExportView.time_filter.value;
        csvExportView.storage_path = csvExportView.storage_path.value;

        expect(csvExportView.changedAttributes).toEqual({});
    });
});

describe('CsvExportView Responses Tests', () => {
    it('converts CsvExportView object to JSON representation', () => {
        const csvExportView = CsvExportView.create(CsvExportViewMother.dto());
        const csvExportViewResponse = new CsvExportViewResponse(csvExportView);

        const json = csvExportViewResponse.toJson();

        expect(json).toEqual({
            data: {
                id: csvExportView.id.value,
                description: csvExportView.description.value,
                is_active: csvExportView.is_active.value,
                views: csvExportView.views.value,
                frequency: csvExportView.frequency.value,
                interval: csvExportView.interval.value,
                time_filter: csvExportView.time_filter.value,
                storage_path: csvExportView.storage_path.value,
                last_execution_at: csvExportView.last_execution_at.value,
                details: csvExportView.details.value,
                next_execution_at: csvExportView.next_execution_at.value,
                created_by: csvExportView.created_by.value,
                created_at: csvExportView.created_at.value,
                updated_at: csvExportView.updated_at.value,
                updated_by: csvExportView.updated_by.value,
            },
        });
    });

    it('returns an empty object if CsvExportView is not provided', () => {
        const csvExportViewResponse = new CsvExportViewResponse(null);
        expect(csvExportViewResponse.toJson()).toEqual({});
    });

    it('converts CsvExportViewCollection to JSON representation', () => {
        const csvExportViewCollection = [
            CsvExportView.create(CsvExportViewMother.dto()),
            CsvExportView.create(CsvExportViewMother.dto()),
        ];
        const csvExportViewCollectionResponse = new CsvExportViewCollectionResponse(
            csvExportViewCollection,
            csvExportViewCollection.length
        );

        const json = csvExportViewCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: csvExportViewCollection.map(
                    (csvExportView) => new CsvExportViewResponse(csvExportView).toJson().data
                ),
            },
            metadata: {
                count: csvExportViewCollection.length,
            },
        });
    });
});

describe('ValueObjectCsvFormatting', () => {
    it('should apply default values when no value is provided', () => {
        const formatting = new ValueObjectCsvFormatting(null);
        expect(formatting.value).toEqual({
            separator: ',',
            valueQuotes: true,
            headerQuotes: true,
            includeHeader: true,
            encoding: 'utf-8',
            lineTerminator: '\n',
            nullValue: '',
        });
    });

    it('should apply partial custom values and fill the rest with defaults', () => {
        const input = {
            separator: ';',
            encoding: 'latin1',
        };

        const formatting = new ValueObjectCsvFormatting(input);

        expect(formatting.value).toEqual({
            separator: ';',
            valueQuotes: true,
            headerQuotes: true,
            includeHeader: true,
            encoding: 'latin1',
            lineTerminator: '\n',
            nullValue: '',
        });
    });

    it('should throw if separator is not a string', () => {
        expect(() => new ValueObjectCsvFormatting({ separator: 123 })).toThrow(ValidationFailError);
    });

    it('should throw if valueQuotes is not a boolean', () => {
        expect(() => new ValueObjectCsvFormatting({ valueQuotes: 'true' })).toThrow(ValidationFailError);
    });

    it('should throw if headerQuotes is not a boolean', () => {
        expect(() => new ValueObjectCsvFormatting({ headerQuotes: 'false' })).toThrow(ValidationFailError);
    });

    it('should throw if includeHeader is not a boolean', () => {
        expect(() => new ValueObjectCsvFormatting({ includeHeader: 'yes' })).toThrow(ValidationFailError);
    });

    it('should throw if encoding is invalid', () => {
        expect(() => new ValueObjectCsvFormatting({ encoding: 'binary' })).toThrow(ValidationFailError);
    });

    it('should throw if lineTerminator is invalid', () => {
        expect(() => new ValueObjectCsvFormatting({ lineTerminator: '\r' })).toThrow(ValidationFailError);
    });

    it('should throw if nullValue is not a string', () => {
        expect(() => new ValueObjectCsvFormatting({ nullValue: null })).toThrow(ValidationFailError);
    });
});
