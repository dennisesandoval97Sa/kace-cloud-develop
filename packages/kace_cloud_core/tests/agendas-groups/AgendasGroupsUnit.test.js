import { AgendasGroups } from '../../src/agendas-groups/domain/AgendasGroups';
import { UuidError } from '../../src/shared';
import { AgendasGroupsMother } from './domain/AgendasGroupsMother';
import { AgendasGroupsResponse } from '../../src/agendas-groups/application/AgendasGroupsResponse';
import { AgendasGroupsCollectionResponse } from '../../src/agendas-groups/application/AgendasGroupsCollectionResponse';

describe('Agendas Groups Entity', () => {
    const dto = AgendasGroupsMother.dto();

    it('should throw an error if the agenda id is not a valid uuid', async () => {
        const dtoWithInvalidAgendaId = { ...dto, agenda_id: 'invalid-uuid' };
        expect(() => AgendasGroups.create(dtoWithInvalidAgendaId)).toThrow(UuidError);
    });

    it('should throw an error if the group id is not a valid uuid', async () => {
        const dtoWithInvalidGroupId = { ...dto, group_id: 'invalid-uuid' };
        expect(() => AgendasGroups.create(dtoWithInvalidGroupId)).toThrow(UuidError);
    });

    it('should create an instance of AgendasGroups', async () => {
        const agendasGroups = AgendasGroups.create(dto);
        expect(agendasGroups).toBeInstanceOf(AgendasGroups);
    });

    it('should return the agenda id', async () => {
        const agendasGroups = AgendasGroups.create(dto);
        expect(agendasGroups.agenda_id.value).toBe(dto.agenda_id);
    });

    it('should return the group id', async () => {
        const agendasGroups = AgendasGroups.create(dto);
        expect(agendasGroups.group_id.value).toBe(dto.group_id);
    });
});

describe('Agendas groups responses tests', () => {
    it('should AgendasGroups object to JSON', async () => {
        const AgendasGroupsDto = AgendasGroupsMother.dto();
        const agendasGroups = AgendasGroups.create(AgendasGroupsDto);
        const agendasGroupsResponse = new AgendasGroupsResponse(agendasGroups);

        expect(agendasGroupsResponse.toJson()).toEqual({
            data: {
                agenda_id: agendasGroups.agenda_id.value,
                group_id: agendasGroups.group_id.value,
            },
        });
    });

    it('should return an empty object if there is no agendasGroups', async () => {
        const agendasGroupsResponse = new AgendasGroupsResponse(null);

        expect(agendasGroupsResponse.toJson()).toEqual({});
    });

    it('should return AgendasGroupsCollection object to JSON', async () => {
        const AgendasGroupsDto = AgendasGroupsMother.dto();
        const agendasGroupsCollection = Array.from({ length: 3 }, () => AgendasGroups.create(AgendasGroupsDto));
        const agendasGroupsResponse = new AgendasGroupsCollectionResponse(agendasGroupsCollection, 3);

        const expectedJson = {
            data: {
                items: agendasGroupsCollection.map(
                    (agendasGroups) => new AgendasGroupsResponse(agendasGroups).toJson().data
                ),
            },
            metadata: {
                count: 3,
            },
        };

        expect(agendasGroupsResponse.toJson().data.items).toHaveLength(3);
        expect(agendasGroupsResponse.toJson()).toMatchObject(expectedJson);
    });

    it('should return an empty object if there is no agendasGroupsCollection', async () => {
        const agendasGroupsResponse = new AgendasGroupsCollectionResponse(null, 0);

        expect(agendasGroupsResponse.toJson()).toEqual({
            data: {
                items: [],
            },
            metadata: {
                count: 0,
            },
        });
    });
});
