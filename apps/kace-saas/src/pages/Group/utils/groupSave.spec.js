import { describe, expect, it } from "vitest";
import { buildGroupMutationData, getGroupMembershipChanges } from "./groupSave";

const GROUP_ID = "10000000-0000-4000-8000-000000000001";
const USER_A = "20000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";
const USER_C = "20000000-0000-4000-8000-000000000003";

describe("group save contract", () => {
    it("sends deduplicated selected user ids in the group create payload without a client id", () => {
        const result = buildGroupMutationData({ nombre: "Support", horario_id: GROUP_ID, usuarios: [{ id: USER_C }] }, [
            USER_A,
            USER_A,
            "",
            USER_B,
        ]);

        expect(result).toMatchObject({
            id: undefined,
            url: "/groups",
            isCreate: true,
            dataPost: {
                nombre: "Support",
                horario_id: GROUP_ID,
                user_ids: [USER_A, USER_B],
            },
        });
        expect(result.dataPost).not.toHaveProperty("id");
        expect(result.dataPost).not.toHaveProperty("usuarios");
    });

    it("does not send the read-only horario_description that the group detail returns", () => {
        const result = buildGroupMutationData({
            id: GROUP_ID,
            nombre: "Support",
            horario_id: GROUP_ID,
            horario_description: "Horario A",
        });

        expect(result.dataPost).toMatchObject({ nombre: "Support", horario_id: GROUP_ID });
        expect(result.dataPost).not.toHaveProperty("horario_description");
    });

    it("does not schedule relationship endpoint writes after group creation", () => {
        expect(
            getGroupMembershipChanges({
                isCreate: true,
                groupId: GROUP_ID,
                currentUsers: [],
                selectedUserIds: [USER_A],
            }),
        ).toEqual({ toAdd: [], toRemove: [] });
    });

    it("normalizes an invalid selected-user value to an empty create list", () => {
        expect(buildGroupMutationData({ nombre: "Support" }, null).dataPost.user_ids).toEqual([]);
    });

    it("preserves add and remove membership synchronization for group edits", () => {
        expect(
            getGroupMembershipChanges({
                isCreate: false,
                groupId: GROUP_ID,
                currentUsers: [
                    { usuario_id: USER_A, grupo_id: GROUP_ID },
                    { usuario_id: USER_B, grupo_id: GROUP_ID },
                ],
                selectedUserIds: [USER_B, USER_C],
            }),
        ).toEqual({
            toAdd: [{ usuario_id: USER_C, grupo_id: GROUP_ID }],
            toRemove: [{ usuario_id: USER_A, grupo_id: GROUP_ID }],
        });
    });
});
