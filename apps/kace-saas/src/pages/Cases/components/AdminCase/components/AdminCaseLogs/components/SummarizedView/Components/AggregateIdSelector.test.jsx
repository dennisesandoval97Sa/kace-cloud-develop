import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { filterByIsActive, filterByIsPrimary } from "@/utils/genericFilters";
import { AggregateIdSelector } from "./AggregateIdSelector";

vi.mock("@kace/ui-shared", () => ({
    MultiSelect: () => null,
}));

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));

describe("AggregateIdSelector", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGenericSearchQuery.mockReturnValue({ data: null, isFetching: false, isError: false });
    });

    it("aplica is_primary solo al selector de RestFlows", () => {
        render(<AggregateIdSelector listValues={[]} setListValues={vi.fn()} />);

        const [actionsCall, restFlowsCall] = useGenericSearchQuery.mock.calls;

        expect(actionsCall[0].filter).toContainEqual(filterByIsActive);
        expect(actionsCall[0].filter).not.toContainEqual(filterByIsPrimary);

        expect(restFlowsCall[0].filter).toContainEqual(filterByIsActive);
        expect(restFlowsCall[0].filter).toContainEqual(filterByIsPrimary);
    });
});
