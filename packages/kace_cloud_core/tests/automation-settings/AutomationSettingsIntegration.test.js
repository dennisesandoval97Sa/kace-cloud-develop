import { AutomationSettingsCounter } from '../../src/automation-settings/domain/AutomationSettingsCounter.js';
import { KnexAutomationSettingsRepository } from '../../src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { AutomationSettingsResponse } from '../../src/automation-settings/application/AutomationSettingsResponse.js';
import { AutomationSettingsCollectionResponse } from '../../src/automation-settings/application/AutomationSettingsCollectionResponse.js';
import { AutomationSettingsCreator } from '../../src/automation-settings/application/create/AutomationSettingsCreator.js';
import { AutomationSettingsFinder } from '../../src/automation-settings/application/find/AutomationSettingsFinder.js';
import { AutomationSettingsUpdater } from '../../src/automation-settings/application/update/AutomationSettingsUpdater.js';
import AutomationSettingsMother from './domain/AutomationSettingsMother.js';
import { AutomationSettings } from '../../src/automation-settings/domain/AutomationSettings.js';
import { AutomationSettingsDeleter } from '../../src/automation-settings/application/delete/AutomationSettingsDeleter.js';
import { AutomationSettingsSearcher } from '../../src/automation-settings/application/search/AutomationSettingsSearcher.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { ValidationFailError } from '../../src/shared/index.js';
import {
    AutomationValidationService,
    AUTOMATION_NOT_APPLICABLE_REASON,
} from '../../src/automation-settings/domain/AutomationValidationService.js';

describe('AutomationSettings Integration Tests', () => {
    const repository = new KnexAutomationSettingsRepository(knexConfig);
    const date = new Date();

    it('should create a AutomationSettings', async () => {
        const dto = AutomationSettingsMother.dto();

        const automationSettingsCreator = new AutomationSettingsCreator(repository);

        await automationSettingsCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing AutomationSettings', async () => {
        const AutomationSettings = await AutomationSettingsMother.create(repository);
        const automationSettingsFinder = new AutomationSettingsFinder(repository);

        const AutomationSettingsResult = await automationSettingsFinder.execute(AutomationSettings.id.value);

        expect(AutomationSettingsResult).not.toBeNull();
        expect(AutomationSettingsResult).toBeInstanceOf(AutomationSettingsResponse);
    });

    it('can update an existing AutomationSettings', async () => {
        const automationSettings = await AutomationSettingsMother.create(repository);

        const automationSettingsUpdater = new AutomationSettingsUpdater(repository);

        const newValues = { description: 'Updated automation settings description' };
        await automationSettingsUpdater.execute(automationSettings.id.value, newValues);

        const result = await repository.find(automationSettings.id);

        expect(result).toBeInstanceOf(AutomationSettings);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing AutomationSettings', async () => {
        const automationSettings = await AutomationSettingsMother.create(repository);
        const automationSettingsDeleter = new AutomationSettingsDeleter(repository);

        await automationSettingsDeleter.execute(automationSettings.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(automationSettings.id);
        expect(result).toBeInstanceOf(AutomationSettings);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for AutomationSettings with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await AutomationSettingsMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const automationSettingsSearcher = new AutomationSettingsSearcher(repository);

        const searchResult = await automationSettingsSearcher.execute(dtoCriteria);
        expect(searchResult).toBeInstanceOf(AutomationSettingsCollectionResponse);
    });

    it('should throw an error when creating an existing AutomationSettings', async () => {
        const automationSettings = await AutomationSettingsMother.create(repository);
        const automationSettingsCreator = new AutomationSettingsCreator(repository);

        const dto = { ...AutomationSettingsMother.dto(), id: automationSettings.id.value };
        await expect(automationSettingsCreator.execute(dto)).rejects.toThrow(
            new ValidationFailError(`AutomationSettings with id ${dto.id} already exists`, 'id')
        );
    });

    it('should return instance ValidationFailError when trying to find a AutomationSettings with a non-existent ID', async () => {
        const automationSettingsFinder = new AutomationSettingsFinder(repository);

        await expect(automationSettingsFinder.execute(uuid())).rejects.toThrow(ValidationFailError);
    });

    it('should throw an error when creating a AutomationSettings with invalid data', async () => {
        const dto = AutomationSettingsMother.dto();
        delete dto.id;
        const automationSettingsCreator = new AutomationSettingsCreator(repository);

        await expect(automationSettingsCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent AutomationSettings', async () => {
        const automationSettingsUpdater = new AutomationSettingsUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(automationSettingsUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `AutomationSettings with id ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent AutomationSettings', async () => {
        const automationSettingsDeleter = new AutomationSettingsDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            automationSettingsDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(`AutomationSettings with id ${nonExistentId} does not exist.`);
    });

    it('should count AutomationSettings instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await AutomationSettingsMother.create(repository);
        }
        const counter = new AutomationSettingsCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('Incorrect validation of cron expression when trying to find a non-existent ID', async () => {
        const validation = await new AutomationValidationService(repository).execute(uuid());
        expect(validation).toBe(false);
    });

    it('evaluate explains automation_not_found for a non-existent ID', async () => {
        const verdict = await new AutomationValidationService(repository).evaluate(uuid());
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.AUTOMATION_NOT_FOUND });
    });

    it('evaluate explains automation_window_not_started when start_date is in the future', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 2);
        const row = await AutomationSettingsMother.create(repository, { start_date: startDate });

        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_NOT_STARTED });
    });

    it('evaluate explains automation_window_expired when end_date is in the past', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 10);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        const row = await AutomationSettingsMother.create(repository, { start_date: startDate, end_date: endDate });

        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_EXPIRED });
    });

    it('evaluate explains cron_mismatch when the cron never matches the current date', async () => {
        const row = await AutomationSettingsMother.create(repository, { frequency: '* * * * * 2024' });

        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH });
    });

    it('evaluate returns applicable=true with no reason for a valid automation', async () => {
        const row = await AutomationSettingsMother.create(repository);

        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: true, reason: null });
    });

    it('Correct validation of the cron expression ´* * * * *´', async () => {
        const row = await AutomationSettingsMother.create(repository);

        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });

    it('Correct validation of the cron expression ´0-59 0-23 * * *´', async () => {
        const initialData = {
            frequency: '0-59 0-23 * * *',
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });

    it('Correct validation of the cron expression ´0-59 0-23 1-31 1-12 1-7´', async () => {
        const initialData = {
            frequency: '0-59 0-23 1-31 1-12 1-7',
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });

    // El original fijaba '0,1 * * * *' y esperaba false, pero `#shouldRun` compara
    // contra `new Date()`: en los minutos 0 y 1 de cualquier hora daba true. La
    // lista de minutos se construye ahora excluyendo el minuto actual.
    it('Incorrect validation of a minute list that excludes the current minute', async () => {
        const currentMinute = new Date().getMinutes();
        const initialData = {
            frequency: `${(currentMinute + 20) % 60},${(currentMinute + 40) % 60} * * * *`,
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH });
    });

    it('Correct validation of the cron expression ´0/1 * * * *´', async () => {
        const initialData = {
            frequency: '0/1 * * * *',
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });

    it('Incorrect validation of the cron expression ´* 23 * * * 2024´', async () => {
        const initialData = {
            frequency: '* 23 * * * 2024',
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(false);
    });

    // El original fijaba '* * 11 * 1' y esperaba false, pero `#shouldRun` compara
    // contra `new Date()`: los dias 11 que caen en lunes daba true. Se fija ahora
    // un dia del mes que nunca es hoy, dejando el dia de la semana coincidiendo
    // para comprobar que los dos campos se combinan con AND y no con OR.
    it('Incorrect validation when the day of month does not match even though the day of week does', async () => {
        const now = new Date();
        const otherDayOfMonth = (now.getDate() % 28) + 1;
        const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        const initialData = {
            frequency: `* * ${otherDayOfMonth} * ${currentDayOfWeek}`,
        };
        const row = await AutomationSettingsMother.create(repository, initialData);
        const verdict = await new AutomationValidationService(repository).evaluate(row.id.value);
        expect(verdict).toEqual({ applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH });
    });

    it('Correct functioning of the normalization of the month', async () => {
        const nameMonth = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const initialData = {
            frequency: `* * * ${nameMonth} *`,
        };
        const row = await AutomationSettingsMother.create(repository, initialData);

        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });

    it('Correct functioning of the normalization of the day of week', async () => {
        const nameDay = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        const initialData = {
            frequency: `* * * * ${nameDay}`,
        };
        const row = await AutomationSettingsMother.create(repository, initialData);

        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });
    it('incorrect  functioning of the normalization of the month', async () => {
        const initialData = {
            frequency: '* * * JPL *',
        };
        await expect(AutomationSettingsMother.create(repository, initialData)).rejects.toThrow(
            'Invalid numeric value in month: JPL'
        );
    });
    it('incorrect  functioning of the normalization of the day of week', async () => {
        const initialData = {
            frequency: '* * * * MPN',
        };
        await expect(AutomationSettingsMother.create(repository, initialData)).rejects.toThrow(
            'Invalid numeric value in day-of-week: MPN'
        );
    });

    it('Incorrect validation automation settings date out of range', async () => {
        const initialData = {
            start_date: new Date('2025-05-06'),
            end_date: new Date('2025-05-07'),
        };
        const row = await AutomationSettingsMother.create(repository, initialData);

        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(false);
    });

    it('Correct validation automation configuration date within range', async () => {
        const row = await AutomationSettingsMother.create(repository);

        const validation = await new AutomationValidationService(repository).execute(row.id.value);
        expect(validation).toBe(true);
    });
});
