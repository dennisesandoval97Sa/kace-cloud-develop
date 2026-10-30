import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MultiSelectGroups from "@kace_v2/shared/ui/organisms/MultiSelectGroups";

vi.mock("react-intersection-observer", () => ({
    useInView: () => ({ ref: () => {}, inView: false }),
}));

vi.mock("@kace_v2/shared/hooks/useGroupsOptions.hook", () => ({
    default: () => ({
        groups: [],
        groupsOptions: [],
        setGroups: vi.fn(),
        onSearch: vi.fn().mockResolvedValue([]),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
    }),
}));

describe("MultiSelectGroups label", () => {
    it("renderiza el label recibido por props", () => {
        render(<MultiSelectGroups label="Groups" initialGroups={[]} />);

        expect(screen.getByText("Groups")).toBeInTheDocument();
        expect(screen.queryByText("Grupos")).not.toBeInTheDocument();
    });

    it("usa 'Grupos' cuando no recibe label", () => {
        render(<MultiSelectGroups initialGroups={[]} />);

        expect(screen.getByText("Grupos")).toBeInTheDocument();
    });
});
