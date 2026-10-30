import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import useCombinedBulkActionsOrchestrator, {
    COMBINED_BULK_ACTIONS_ORDER,
    submitFormikSection,
    submitOptionalFormikSection,
} from "./useCombinedBulkActionsOrchestrator.hook.js";

describe("useCombinedBulkActionsOrchestrator", () => {
    it("executes steps in the fixed order and skips disabled ones", async () => {
        const executionOrder = [];
        const steps = {
            change_state: {
                enabled: true,
                submit: vi.fn(async () => {
                    executionOrder.push("change_state");
                    return { processed: 2, total: 2 };
                }),
            },
            reassign: { enabled: false, submit: vi.fn() },
            close: {
                enabled: true,
                submit: vi.fn(async () => {
                    executionOrder.push("close");
                    return { processed: 1, total: 1 };
                }),
            },
        };

        const { result } = renderHook(() => useCombinedBulkActionsOrchestrator({ steps }));

        let acc;
        await act(async () => {
            acc = await result.current.runAll();
        });

        expect(executionOrder).toEqual(["change_state", "close"]);
        expect(steps.reassign.submit).not.toHaveBeenCalled();
        expect(acc.change_state.status).toBe("success");
        expect(acc.reassign.status).toBe("skipped");
        expect(acc.close.status).toBe("success");
        expect(result.current.hasAnyFailure).toBe(false);
        expect(result.current.hasRunAny).toBe(true);
    });

    it("keeps running remaining steps when one step throws, and marks it as error", async () => {
        const error = Object.assign(new Error("boom"), {
            bulkProcessedCount: 1,
            bulkTotalCount: 3,
            bulkFailedIds: ["c3"],
        });
        const steps = {
            change_state: {
                enabled: true,
                submit: vi.fn(async () => {
                    throw error;
                }),
            },
            reassign: { enabled: true, submit: vi.fn(async () => ({ processed: 1, total: 1 })) },
            close: { enabled: true, submit: vi.fn(async () => ({ processed: 1, total: 1 })) },
        };

        const { result } = renderHook(() => useCombinedBulkActionsOrchestrator({ steps }));

        let acc;
        await act(async () => {
            acc = await result.current.runAll();
        });

        expect(steps.reassign.submit).toHaveBeenCalled();
        expect(steps.close.submit).toHaveBeenCalled();
        expect(acc.change_state.status).toBe("error");
        expect(acc.change_state.processed).toBe(1);
        expect(acc.change_state.total).toBe(3);
        expect(acc.change_state.failedIds).toEqual(["c3"]);
        expect(result.current.hasAnyFailure).toBe(true);
    });

    it("marks a step as partial when processed is less than total", async () => {
        const steps = {
            change_state: { enabled: true, submit: vi.fn(async () => ({ processed: 1, total: 2 })) },
            reassign: { enabled: false, submit: vi.fn() },
            close: { enabled: false, submit: vi.fn() },
        };

        const { result } = renderHook(() => useCombinedBulkActionsOrchestrator({ steps }));

        let acc;
        await act(async () => {
            acc = await result.current.runAll();
        });

        expect(acc.change_state.status).toBe("partial");
        expect(result.current.hasAnyFailure).toBe(true);
    });

    it("reports allSkipped=true via onAllSettled when every step is disabled", async () => {
        const onAllSettled = vi.fn();
        const steps = {
            change_state: { enabled: false, submit: vi.fn() },
            reassign: { enabled: false, submit: vi.fn() },
            close: { enabled: false, submit: vi.fn() },
        };

        const { result } = renderHook(() => useCombinedBulkActionsOrchestrator({ steps, onAllSettled }));

        await act(async () => {
            await result.current.runAll();
        });

        expect(onAllSettled).toHaveBeenCalledTimes(1);
        const [acc, meta] = onAllSettled.mock.calls[0];
        expect(meta.allSkipped).toBe(true);
        expect(Object.keys(acc)).toEqual(COMBINED_BULK_ACTIONS_ORDER);
    });

    it("reset clears results and isRunning", async () => {
        const steps = {
            change_state: { enabled: true, submit: vi.fn(async () => ({ processed: 1, total: 1 })) },
            reassign: { enabled: false, submit: vi.fn() },
            close: { enabled: false, submit: vi.fn() },
        };

        const { result } = renderHook(() => useCombinedBulkActionsOrchestrator({ steps }));

        await act(async () => {
            await result.current.runAll();
        });
        expect(result.current.hasRunAny).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.hasRunAny).toBe(false);
        expect(result.current.isRunning).toBe(false);
    });
});

describe("submitFormikSection", () => {
    it("returns undefined when the formik ref is not attached", async () => {
        const formikRef = { current: null };
        await expect(submitFormikSection(formikRef)).resolves.toBeUndefined();
    });

    it("returns the submitForm outcome when there are no pending validation errors", async () => {
        const formikRef = {
            current: {
                submitForm: vi.fn(async () => ({ processed: 1, total: 1 })),
                errors: {},
            },
        };

        await expect(submitFormikSection(formikRef)).resolves.toEqual({ processed: 1, total: 1 });
    });

    it("throws when validation errors remain after submitForm resolves", async () => {
        const formikRef = {
            current: {
                submitForm: vi.fn(async () => undefined),
                errors: { grupo_id: "required" },
            },
        };

        await expect(submitFormikSection(formikRef)).rejects.toThrow("validation_failed");
    });

    it("re-reads formikRef.current after submitForm instead of using a captured reference", async () => {
        const staleInstance = { submitForm: vi.fn(), errors: {} };
        const freshInstance = {
            submitForm: vi.fn(async () => {
                formikRef.current = freshInstance;
                return { ok: true };
            }),
            errors: { grupo_id: "required" },
        };
        const formikRef = { current: staleInstance };
        formikRef.current = freshInstance;

        await expect(submitFormikSection(formikRef)).rejects.toThrow("validation_failed");
    });
});

describe("submitOptionalFormikSection", () => {
    it("skips submission when the section is considered empty", async () => {
        const formikRef = { current: { values: {}, submitForm: vi.fn(), errors: {} } };
        const isEmpty = vi.fn(() => true);

        await expect(submitOptionalFormikSection(formikRef, isEmpty)).resolves.toEqual({ skipped: true });
        expect(formikRef.current.submitForm).not.toHaveBeenCalled();
    });

    it("delegates to submitFormikSection when the section has data", async () => {
        const formikRef = {
            current: {
                values: { grupo_id: "1" },
                submitForm: vi.fn(async () => ({ processed: 1, total: 1 })),
                errors: {},
            },
        };
        const isEmpty = vi.fn(() => false);

        await expect(submitOptionalFormikSection(formikRef, isEmpty)).resolves.toEqual({ processed: 1, total: 1 });
        expect(formikRef.current.submitForm).toHaveBeenCalled();
    });

    it("skips when the ref is not attached, without calling isEmpty on undefined values", async () => {
        const formikRef = { current: null };
        const isEmpty = vi.fn(() => true);

        await expect(submitOptionalFormikSection(formikRef, isEmpty)).resolves.toEqual({ skipped: true });
    });
});
