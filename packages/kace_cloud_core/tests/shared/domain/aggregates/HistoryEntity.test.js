import { HistoryEntity } from '../../../../src/shared/domain/aggregates/HistoryEntity.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';
import ValueObjectJsonHistory from '../../../../src/shared/domain/value-object/ValueObjectJsonHistory.js';

describe('HistoryEntity', () => {
    let validDto;
    let historyEntity;

    beforeEach(() => {
        validDto = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            entity_id: '987fcdeb-51a2-43d1-9f12-345678901234',
            changed_attributes: { name: 'Juan', email: 'juan@example.com' },
            new_attributes: { name: 'Juan Carlos', email: 'juancarlos@example.com' },
            original_attributes: { name: 'Juan', email: 'juan@example.com' },
        };
    });

    describe('Constructor', () => {
        it('should create a HistoryEntity instance with valid DTO', () => {
            historyEntity = new HistoryEntity(validDto);

            expect(historyEntity).toBeInstanceOf(HistoryEntity);
            expect(historyEntity.id).toBeInstanceOf(ValueObjectUuid);
            expect(historyEntity.entity_id).toBeInstanceOf(ValueObjectUuid);
            expect(historyEntity.changed_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            expect(historyEntity.new_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            expect(historyEntity.original_attributes).toBeInstanceOf(ValueObjectJsonHistory);
        });

        it('should create HistoryEntity with creator_name and expose it', () => {
            const dtoWithCreator = { ...validDto, creator_name: 'Juan Pérez García' };
            historyEntity = new HistoryEntity(dtoWithCreator);

            expect(historyEntity.creator_name).toBeDefined();
            expect(historyEntity.creator_name.value).toBe('Juan Pérez García');
        });

        it('should create HistoryEntity with nullable JSON attributes', () => {
            const dtoWithNulls = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                entity_id: '987fcdeb-51a2-43d1-9f12-345678901234',
                changed_attributes: null,
                new_attributes: null,
                original_attributes: null,
            };

            historyEntity = new HistoryEntity(dtoWithNulls);

            expect(historyEntity.changed_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            expect(historyEntity.new_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            expect(historyEntity.original_attributes).toBeInstanceOf(ValueObjectJsonHistory);
        });

        it('should throw error for invalid UUID in id', () => {
            const invalidDto = { ...validDto, id: 'invalid-uuid' };

            expect(() => new HistoryEntity(invalidDto)).toThrow();
        });

        it('should throw error for invalid UUID in entity_id', () => {
            const invalidDto = { ...validDto, entity_id: 'invalid-uuid' };

            expect(() => new HistoryEntity(invalidDto)).toThrow();
        });

        it('should throw error for null entity_id', () => {
            const invalidDto = { ...validDto, entity_id: null };

            expect(() => new HistoryEntity(invalidDto)).toThrow();
        });
    });

    describe('Getters and Setters', () => {
        beforeEach(() => {
            historyEntity = new HistoryEntity(validDto);
        });

        describe('entity_id', () => {
            it('should get entity_id value', () => {
                expect(historyEntity.entity_id.value).toBe(validDto.entity_id);
            });

            it('should set entity_id with valid UUID', () => {
                const newEntityId = '123e4567-e89b-12d3-a456-426614174000';
                historyEntity.entity_id = newEntityId;

                expect(historyEntity.entity_id.value).toBe(newEntityId);
            });

            it('should throw error when setting invalid UUID', () => {
                expect(() => {
                    historyEntity.entity_id = 'invalid-uuid';
                }).toThrow();
            });
        });

        describe('changed_attributes', () => {
            it('should get changed_attributes value', () => {
                expect(historyEntity.changed_attributes.value).toEqual(validDto.changed_attributes);
            });

            it('should set changed_attributes with valid JSON', () => {
                const newAttributes = { status: 'active', role: 'admin' };
                historyEntity.changed_attributes = newAttributes;

                expect(historyEntity.changed_attributes.value).toEqual(newAttributes);
            });

            it('should allow setting null value', () => {
                historyEntity.changed_attributes = null;

                expect(historyEntity.changed_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            });
        });

        describe('new_attributes', () => {
            it('should get new_attributes value', () => {
                expect(historyEntity.new_attributes.value).toEqual(validDto.new_attributes);
            });

            it('should set new_attributes with valid JSON', () => {
                const newAttributes = { status: 'inactive', role: 'user' };
                historyEntity.new_attributes = newAttributes;

                expect(historyEntity.new_attributes.value).toEqual(newAttributes);
            });

            it('should allow setting null value', () => {
                historyEntity.new_attributes = null;

                expect(historyEntity.new_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            });
        });

        describe('original_attributes', () => {
            it('should get original_attributes value', () => {
                expect(historyEntity.original_attributes.value).toEqual(validDto.original_attributes);
            });

            it('should set original_attributes with valid JSON', () => {
                const newAttributes = { status: 'pending', role: 'guest' };
                historyEntity.original_attributes = newAttributes;

                expect(historyEntity.original_attributes.value).toEqual(newAttributes);
            });

            it('should allow setting null value', () => {
                historyEntity.original_attributes = null;

                expect(historyEntity.original_attributes).toBeInstanceOf(ValueObjectJsonHistory);
            });
        });
    });

    describe('Static create method', () => {
        it('should create HistoryEntity instance using static create method', () => {
            historyEntity = HistoryEntity.create(validDto);

            expect(historyEntity).toBeInstanceOf(HistoryEntity);
            expect(historyEntity.id.value).toBe(validDto.id);
            expect(historyEntity.entity_id.value).toBe(validDto.entity_id);
        });
    });

    describe('Inheritance from AggregateRoot', () => {
        beforeEach(() => {
            historyEntity = new HistoryEntity(validDto);
        });

        it('should inherit AggregateRoot methods', () => {
            expect(typeof historyEntity.update).toBe('function');
            expect(typeof historyEntity.delete).toBe('function');
            expect(typeof historyEntity.flushChanges).toBe('function');
            expect(typeof historyEntity.toJson).toBe('function');
            expect(typeof historyEntity.isDeleted).toBe('function');
        });

        it('should have changedAttributes property', () => {
            expect(historyEntity.changedAttributes).toBeDefined();
            expect(typeof historyEntity.changedAttributes).toBe('object');
        });

        it('should track changes when updating attributes', () => {
            const updateDto = {
                changed_attributes: { status: 'updated' },
                new_attributes: { status: 'new' },
            };

            historyEntity.update(updateDto);

            expect(historyEntity.changedAttributes).toHaveProperty('changed_attributes');
            expect(historyEntity.changedAttributes).toHaveProperty('new_attributes');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty JSON objects', () => {
            const dtoWithEmptyObjects = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                entity_id: '987fcdeb-51a2-43d1-9f12-345678901234',
                changed_attributes: {},
                new_attributes: {},
                original_attributes: {},
            };

            historyEntity = new HistoryEntity(dtoWithEmptyObjects);

            expect(historyEntity.changed_attributes.value).toEqual({});
            expect(historyEntity.new_attributes.value).toEqual({});
            expect(historyEntity.original_attributes.value).toEqual({});
        });

        it('should handle complex nested JSON objects', () => {
            const complexDto = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                entity_id: '987fcdeb-51a2-43d1-9f12-345678901234',
                changed_attributes: {
                    user: {
                        profile: {
                            preferences: {
                                theme: 'dark',
                                language: 'es',
                            },
                        },
                    },
                },
                new_attributes: {
                    user: {
                        profile: {
                            preferences: {
                                theme: 'light',
                                language: 'en',
                            },
                        },
                    },
                },
                original_attributes: {
                    user: {
                        profile: {
                            preferences: {
                                theme: 'dark',
                                language: 'es',
                            },
                        },
                    },
                },
            };

            historyEntity = new HistoryEntity(complexDto);

            expect(historyEntity.changed_attributes.value.user.profile.preferences.theme).toBe('dark');
            expect(historyEntity.new_attributes.value.user.profile.preferences.theme).toBe('light');
        });
    });
});
