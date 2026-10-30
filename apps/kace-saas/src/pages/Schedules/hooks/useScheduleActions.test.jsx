import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { apiService } from "@kace/utils";
import { getTranslatedError } from "../../../utils/getTranslatedError";
import { SCHEDULES_SERVICE } from "../../../utils/URL";
import en from "@/locale/en.json";
import useScheduleActions from "./useScheduleActions";

const translate = (key, options) =>
    key.split(".").reduce((node, part) => node?.[part], en) ?? options?.defaultValue ?? key;

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: translate }),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@kace/utils", () => ({
    apiService: { get: vi.fn() },
}));

vi.mock("../../../hooks/useGeneralMutation", () => ({
    default: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../utils/getTranslatedError", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getTranslatedError: vi.fn(actual.getTranslatedError) };
});

const SCHEDULE_IN_USE_MESSAGE = en.app.errors.public.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS;
const cachedSchedules = { data: [{ id: "keep" }, { id: "doomed" }] };

const renderScheduleActions = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["scheduleData"], cachedSchedules);
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useScheduleActions(), { wrapper });
    return { result, queryClient };
};

/** Shape of the 400 that `GET /schedules/{id}/delete` returns while groups still use the schedule. */
const scheduleInUseError = () =>
    Object.assign(new Error("Request failed with status code 400"), {
        response: {
            status: 400,
            data: {
                message: "Cannot delete: 2 group(s) still use this schedule",
                data: { code: PUBLIC_ERROR_CODES.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS },
            },
        },
    });

describe("useScheduleActions — delete", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("removes the schedule from the cached list while the delete is in flight", async () => {
        let resolveDelete;
        apiService.get.mockReturnValue(new Promise((resolve) => (resolveDelete = resolve)));
        const { result, queryClient } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(queryClient.getQueryData(["scheduleData"]).data).toEqual([{ id: "keep" }]));
        await act(async () => resolveDelete({ status: 200 }));
    });

    it("shows the translated in-use message and restores the cached list when the schedule is still used by groups", async () => {
        const error = scheduleInUseError();
        apiService.get.mockRejectedValue(error);
        const { result, queryClient } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SCHEDULE_IN_USE_MESSAGE));
        expect(getTranslatedError).toHaveBeenCalledWith(error, translate);
        expect(apiService.get).toHaveBeenCalledWith(`${SCHEDULES_SERVICE}/doomed/delete`);
        expect(queryClient.getQueryData(["scheduleData"])).toEqual(cachedSchedules);
        expect(toast.success).not.toHaveBeenCalled();
    });

    const LOCALIZED_DELETE_ERROR = `${en.app.forms.error_delete} ${en.app.title.schedules}`;

    it("shows the localized delete copy, not the raw message, when the request fails without a response", async () => {
        apiService.get.mockRejectedValue(
            Object.assign(new Error("Network Error"), { code: "ERR_NETWORK", request: {} }),
        );
        const { result, queryClient } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOCALIZED_DELETE_ERROR));
        expect(getTranslatedError).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(["scheduleData"])).toEqual(cachedSchedules);
    });

    it("shows the response message when the delete resolves with a non-success status", async () => {
        apiService.get.mockResolvedValue({ status: 500, data: { message: "Delete failed upstream" } });
        const { result, queryClient } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Delete failed upstream"));
        expect(queryClient.getQueryData(["scheduleData"])).toEqual(cachedSchedules);
    });

    it("translates the public error code when the delete resolves with the in-use status", async () => {
        apiService.get.mockResolvedValue(scheduleInUseError().response);
        const { result } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SCHEDULE_IN_USE_MESSAGE));
    });

    it("confirms the delete with a success toast", async () => {
        apiService.get.mockResolvedValue({ status: 200 });
        const { result } = renderScheduleActions();

        act(() => result.current.handleDeleteSchedule("doomed"));

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
        expect(toast.error).not.toHaveBeenCalled();
    });
});
