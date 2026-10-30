import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { useTimeSlotUpdate } from "./useTimeSlotsUpdate";

const mocks = vi.hoisted(() => ({
    cancelQueries: vi.fn(),
    getI18ForErrors: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    mutationOptions: undefined,
    navigate: vi.fn(),
    setQueryData: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        cancelQueries: mocks.cancelQueries,
        getQueryData: mocks.getQueryData,
        invalidateQueries: mocks.invalidateQueries,
        setQueryData: mocks.setQueryData,
    }),
    useMutation: (options) => {
        mocks.mutationOptions = options;

        return {
            mutate: vi.fn(),
            isPending: false,
        };
    },
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            const translations = {
                "app.errors.generic": "Generic localized error",
                "app.errors.public.BAD_REQUEST_ERROR": "Bad request translated",
            };

            return translations[key] ?? options?.defaultValue ?? key;
        },
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: vi.fn(),
    },
}));

vi.mock("@kace/urls", () => ({
    TIME_SLOT_SERVICE: "/time-slots",
}));

vi.mock("@kace/utils", () => ({
    getI18ForErrors: mocks.getI18ForErrors,
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("../data", () => ({
    formatDataBeforePost: vi.fn((values) => values),
}));

describe("useTimeSlotUpdate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
    });

    it("uses public error translation for compatibility errors arrays", () => {
        renderHook(() => useTimeSlotUpdate());

        mocks.mutationOptions.onError(
            {
                response: {
                    data: {
                        data: { code: PUBLIC_ERROR_CODES.BAD_REQUEST_ERROR },
                        errors: [{ code: PUBLIC_ERROR_CODES.BAD_REQUEST_ERROR, message: "Bad request" }],
                    },
                },
            },
            null,
            undefined,
        );

        expect(mocks.toastError).toHaveBeenCalledWith("Bad request translated");
        expect(mocks.getI18ForErrors).not.toHaveBeenCalled();
    });

    it("keeps legacy timeslot validation arrays on the field mapper", () => {
        mocks.getI18ForErrors.mockImplementation((_t, _position, _message, callback) => {
            callback("Mapped timeslot validation");
        });
        renderHook(() => useTimeSlotUpdate());

        mocks.mutationOptions.onError(
            {
                response: {
                    data: {
                        errors: [{ message: "Start time: overlaps existing slot" }],
                    },
                },
            },
            null,
            undefined,
        );

        expect(mocks.getI18ForErrors).toHaveBeenCalledWith(
            expect.any(Function),
            "timeslot",
            "Start time: overlaps existing slot",
            expect.any(Function),
        );
        expect(mocks.toastError).toHaveBeenCalledWith("Mapped timeslot validation");
    });
});
