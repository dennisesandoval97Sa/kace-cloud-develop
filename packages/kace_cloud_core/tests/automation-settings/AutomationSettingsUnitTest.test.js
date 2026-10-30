import { v4 as uuidv4 } from 'uuid';
import { AutomationSettingsResponse } from '../../src/automation-settings/application/AutomationSettingsResponse.js';
import { AutomationSettingsCollectionResponse } from '../../src/automation-settings/application/AutomationSettingsCollectionResponse.js';
import { ValueObjectTimestamp } from '../../src/shared/domain/value-object/ValueObjectTimestamp.js';
import { AutomationSettings } from '../../src/automation-settings/domain/AutomationSettings.js';
import AutomationSettingsMother from './domain/AutomationSettingsMother';

const now = new Date();

const mockUpdateData = {
    description: 'Updated Description',
    frequency: '2 * * * *',
    start_date: now,
    end_date: now,
};

describe('AutomationSettings Entity', () => {
    const dto = AutomationSettingsMother.dto();
    it('should create a AutomationSettings with valid data', () => {
        const automationSettings = AutomationSettings.create(dto);
        expect(automationSettings.id.value).toBe(dto.id);
        expect(automationSettings.description.value).toBe(dto.description);
        expect(automationSettings.frequency.value).toBe(dto.frequency);
        expect(automationSettings.start_date.value).toBe(
            new ValueObjectTimestamp('Start date', dto.start_date, true).value
        );
        expect(automationSettings.end_date.value).toBe(new ValueObjectTimestamp('End date', dto.end_date, true).value);
    });
    it('should update AutomationSettings data', () => {
        const automationSettings = AutomationSettings.create(dto);
        automationSettings.update(mockUpdateData);
        expect(automationSettings.description.value).toBe(mockUpdateData.description);
        expect(automationSettings.frequency.value).toBe(mockUpdateData.frequency);
        expect(automationSettings.start_date.value).toBe(
            new ValueObjectTimestamp('Start date', mockUpdateData.start_date, true).value
        );
        expect(automationSettings.end_date.value).toBe(
            new ValueObjectTimestamp('End date', mockUpdateData.end_date, true).value
        );
    });
    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => AutomationSettings.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const automationSettings = AutomationSettings.create(dto);
        const sameData = { ...dto };
        automationSettings.update(sameData);
        expect(automationSettings.changedAttributes).toEqual({});
    });

    it('marks a AutomationSettings instance as deleted', () => {
        const automationSettings = AutomationSettings.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        automationSettings.delete(deleteDto);
        expect(automationSettings.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(automationSettings.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const automationSettings = AutomationSettings.create(dto);
        automationSettings.deleted_at = null;
        automationSettings.deleted_by = undefined;
        expect(automationSettings.deleted_at.value).toBeNull();
        expect(automationSettings.deleted_by.value).toBeUndefined();
    });

    it('flushes changes in AutomationSettings instance', () => {
        const automationSettings = AutomationSettings.create(dto);
        automationSettings.update(mockUpdateData);
        automationSettings.flushChanges();
        expect(automationSettings.changedAttributes).toEqual({});
    });
});

describe('AutomationSettings Response Tests', () => {
    it('converts AutomationSettings object to JSON representation', () => {
        const automationSettings = AutomationSettings.create(AutomationSettingsMother.dto());
        const automationSettingsResponse = new AutomationSettingsResponse(automationSettings);
        const json = automationSettingsResponse.toJson();
        expect(json).toEqual({
            data: {
                id: automationSettings.id.value,
                description: automationSettings.description.value,
                frequency: automationSettings.frequency.value,
                start_date: automationSettings.start_date.value,
                end_date: automationSettings.end_date.value,
                created_at: automationSettings.created_at.value,
                updated_at: automationSettings.updated_at.value,
            },
        });
    });
    it('returns an empty object if AutomationSettings is not provided', () => {
        const automationSettingsResponse = new AutomationSettingsResponse(null);
        const json = automationSettingsResponse.toJson();
        expect(json).toEqual({});
    });
});
describe('AutomationSettings Collection Response Tests', () => {
    it('converts AutomationSettings collection to JSON representation', () => {
        const automationSettingsCollection = [
            AutomationSettings.create(AutomationSettingsMother.dto()),
            AutomationSettings.create(AutomationSettingsMother.dto()),
        ];
        const automationSettingsCollectionResponse = new AutomationSettingsCollectionResponse(
            automationSettingsCollection,
            automationSettingsCollection.length
        );
        const json = automationSettingsCollectionResponse.toJson();
        expect(json).toEqual({
            data: {
                items: automationSettingsCollection.map(
                    (automationSettings) => new AutomationSettingsResponse(automationSettings).toJson().data
                ),
            },
            metadata: {
                count: automationSettingsCollection.length,
            },
        });
    });
});
