import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import useModelsData from "./useModelsData";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useAuxiliariesOptions", () => ({
    default: vi.fn(() => ({ auxiliariesRules: [], loading: false })),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => null }),
}));

describe("useModelsData includeArrays", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("excludes array fields by default", () => {
        renderHook(() => useModelsData({}));

        expect(useAuxiliariesOptions).toHaveBeenCalledWith(expect.anything(), undefined, { includeArrays: false });
    });

    it("forwards includeArrays:true when requested", () => {
        renderHook(() => useModelsData({ includeArrays: true }));

        expect(useAuxiliariesOptions).toHaveBeenCalledWith(expect.anything(), undefined, { includeArrays: true });
    });
});
