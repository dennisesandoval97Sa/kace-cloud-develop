import { describe, expect, it, vi } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import {
    chunkCaseIds,
    partitionClosedCases,
    runCaseBulkChunks,
    parseBulkAssignResponses,
    resolveBulkOutcomeIds,
    isResponsibleUnavailableError,
    resolveBoardBulkCapabilities,
} from "./boardCasesBulk.utils";

describe("boardCasesBulk.utils", () => {
    describe("chunkCaseIds", () => {
        it("chunks array according to specified max", () => {
            const ids = ["1", "2", "3", "4", "5"];
            const chunks = chunkCaseIds(ids, 2);
            expect(chunks).toEqual([["1", "2"], ["3", "4"], ["5"]]);
        });
    });

    describe("partitionClosedCases", () => {
        it("separates open and closed cases", () => {
            const rows = [
                { id: "1", fecha_resolucion: null },
                { id: "2", fecha_resolucion: "2026-01-01" },
                { id: "3", fecha_resolucion: "" },
            ];
            const { eligibleRows, skippedClosedRows } = partitionClosedCases(rows);
            expect(eligibleRows.map((r) => r.id)).toEqual(["1", "3"]);
            expect(skippedClosedRows.map((r) => r.id)).toEqual(["2"]);
        });
    });

    describe("runCaseBulkChunks", () => {
        it("executes chunks sequentially and collects responses", async () => {
            const caseIds = ["1", "2", "3"];
            const postFn = vi.fn().mockImplementation(async (payload) => ({
                data: { assignedCount: payload.cases.length },
            }));
            const buildPayload = (chunk) => ({ cases: chunk });

            const result = await runCaseBulkChunks(caseIds, postFn, buildPayload);

            expect(result.processedCount).toBe(3);
            expect(result.successIds).toEqual(["1", "2", "3"]);
            expect(result.responses).toEqual([{ data: { assignedCount: 3 } }]);
            expect(postFn).toHaveBeenCalledTimes(1);
        });

        it("attaches bulkResponses and failed IDs if an error occurs", async () => {
            const testIds = ["a", "b", "c", "d"];

            await expect(
                runCaseBulkChunks(
                    testIds,
                    async () => {
                        throw new Error("API error");
                    },
                    (c) => ({ cases: c }),
                ),
            ).rejects.toMatchObject({
                message: "API error",
                bulkProcessedCount: 0,
                bulkTotalCount: 4,
                bulkSuccessIds: [],
                bulkFailedIds: ["a", "b", "c", "d"],
                bulkResponses: [],
            });
        });
    });

    describe("parseBulkAssignResponses", () => {
        it("correctly extracts metadata from backend envelope with data: {} wrapper", () => {
            const responses = [
                {
                    data: {
                        message: "Ok",
                        data: {},
                        metadata: { assignedCount: 2, skippedCount: 1, skippedIds: ["case-3"] },
                        code: "0x030043",
                    },
                },
            ];

            const result = parseBulkAssignResponses(responses, 3);
            expect(result.totalSkipped).toBe(1);
            expect(result.totalAssigned).toBe(2);
            expect(result.isPartial).toBe(true);
            expect(result.allSkippedIds).toEqual(["case-3"]);
        });

        it("falls back to totalCases - skipped when assignedCount is not numeric", () => {
            const responses = [
                {
                    data: {
                        metadata: { skippedCount: 2 },
                    },
                },
            ];

            const result = parseBulkAssignResponses(responses, 5);
            expect(result.totalSkipped).toBe(2);
            expect(result.totalAssigned).toBe(3);
            expect(result.isPartial).toBe(true);
        });
    });

    describe("resolveBulkOutcomeIds", () => {
        it("returns all cases as failed when assigned is 0", () => {
            const outcome = resolveBulkOutcomeIds(["1", "2"], ["1", "2"], 0);
            expect(outcome.successIds).toEqual([]);
            expect(outcome.failedIds).toEqual(["1", "2"]);
        });

        it("uses allSkippedIds when available", () => {
            const outcome = resolveBulkOutcomeIds(["1", "2", "3"], ["1", "2", "3"], 2, ["2"]);
            expect(outcome.successIds).toEqual(["1", "3"]);
            expect(outcome.failedIds).toEqual(["2"]);
        });

        it("partitions by assigned count when allSkippedIds is empty", () => {
            const outcome = resolveBulkOutcomeIds(["1", "2", "3"], ["1", "2", "3"], 1, []);
            expect(outcome.successIds).toEqual(["1"]);
            expect(outcome.failedIds).toEqual(["2", "3"]);
        });
    });

    describe("isResponsibleUnavailableError", () => {
        const mockT = (key) => key;

        it("returns true when error response data contains CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE code", () => {
            const error = {
                response: {
                    data: {
                        code: PUBLIC_ERROR_CODES.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
                    },
                },
            };
            expect(isResponsibleUnavailableError(error, "Some message", mockT)).toBe(true);
        });

        it("returns true when error response data.data contains CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE code", () => {
            const error = {
                response: {
                    data: {
                        data: {
                            code: PUBLIC_ERROR_CODES.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
                        },
                    },
                },
            };
            expect(isResponsibleUnavailableError(error, "Some message", mockT)).toBe(true);
        });

        it("returns true when translated message matches key", () => {
            expect(
                isResponsibleUnavailableError(
                    new Error("generic"),
                    "boards.bulkActions.apiErrors.couldNotAssignResponsible",
                    mockT,
                ),
            ).toBe(true);
        });

        it("returns false for unrelated errors", () => {
            const error = {
                response: {
                    data: {
                        code: "0x999999",
                    },
                },
            };
            expect(isResponsibleUnavailableError(error, "Other message", mockT)).toBe(false);
        });
    });

    describe("resolveBoardBulkCapabilities", () => {
        const all = { canUpdateBoardRegister: true, canBulkClose: true, canBulkTransition: true, canBulkAssign: true };

        it("enables each action only with BoardsUpdateRegister and its bulk permission", () => {
            expect(resolveBoardBulkCapabilities(all)).toEqual({
                canReassign: true,
                canChangeState: true,
                canClose: true,
                missingPermissionKeys: [],
            });
            expect(resolveBoardBulkCapabilities({ ...all, canUpdateBoardRegister: false })).toMatchObject({
                canReassign: false,
                canChangeState: false,
                canClose: false,
            });
        });

        it("allows opening the combined modal with only bulk close", () => {
            const result = resolveBoardBulkCapabilities({
                canUpdateBoardRegister: true,
                canBulkClose: true,
                canBulkTransition: false,
                canBulkAssign: false,
            });
            expect(result).toEqual({
                canReassign: false,
                canChangeState: false,
                canClose: true,
                missingPermissionKeys: [],
            });
        });

        it("lists the missing permission keys when no action is available", () => {
            const result = resolveBoardBulkCapabilities({
                canUpdateBoardRegister: false,
                canBulkClose: false,
                canBulkTransition: false,
                canBulkAssign: false,
            });
            expect(result.missingPermissionKeys).toEqual([
                "boards.bulkActions.permissionBoardsUpdateRegister",
                "boards.bulkActions.permissionCasesBulkAssign",
                "boards.bulkActions.permissionCasesBulkTransition",
                "boards.bulkActions.permissionCasesBulkClose",
            ]);
        });

        it("lists only BoardsUpdateRegister when the bulk permissions exist but the register permission does not", () => {
            const result = resolveBoardBulkCapabilities({ ...all, canUpdateBoardRegister: false });
            expect(result.missingPermissionKeys).toEqual(["boards.bulkActions.permissionBoardsUpdateRegister"]);
        });
    });
});
