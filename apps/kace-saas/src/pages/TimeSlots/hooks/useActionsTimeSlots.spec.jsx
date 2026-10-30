import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import useActionsTimeSlots from "./useActionsTimeSlots";

const mocks = vi.hoisted(() => ({
    deleteAction: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@kace/hooks/usePermissionsUser", () => ({
    default: vi.fn(() => ({ arrayAction: [], canBeCreate: false })),
}));

vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteAction })),
}));

describe("useActionsTimeSlots", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses Appointment Time Slots permissions for every table action", () => {
        renderHook(() => useActionsTimeSlots());

        expect(usePermissionsUser).toHaveBeenCalledWith({
            moduleId: "appointment-time-slots",
            actions: [
                expect.objectContaining({ name: "AppointmentTimeSlotsUpdate" }),
                expect.objectContaining({ name: "AppointmentTimeSlotsDelete" }),
                expect.objectContaining({ name: "AppointmentTimeSlotsRead" }),
            ],
            nameCreate: "AppointmentTimeSlotsCreate",
        });
    });
});
