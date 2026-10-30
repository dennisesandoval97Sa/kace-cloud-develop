import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchFilter } from "./search-filter-save";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k }),
}));

describe("SearchFilter delete", () => {
    const dataUser = {
        filters: {
            application: {
                agente: {
                    cases: {
                        Mine: { reference: "1" },
                    },
                },
            },
        },
    };

    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    const confirmDeleteInAlert = async (user) => {
        expect(screen.getByTestId("filter_delete_alert")).toBeInTheDocument();
        await user.click(screen.getByTestId("filter_delete_alert_confirm"));
    };

    it("calls handleDeleteFilter after AlertDialog confirm", async () => {
        const user = userEvent.setup();
        const handleSelectFilter = vi.fn();
        const handleDeleteFilter = vi.fn().mockResolvedValue(true);
        render(
            <SearchFilter
                handleSelectFilter={handleSelectFilter}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );
        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        await confirmDeleteInAlert(user);
        expect(handleDeleteFilter).toHaveBeenCalledWith("Mine");
        expect(handleSelectFilter).not.toHaveBeenCalled();
    });

    it("clears the selected badge when the deleted filter was selected", async () => {
        const user = userEvent.setup();
        const handleDeleteFilter = vi.fn().mockResolvedValue(true);
        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_option_Mine"));
        expect(screen.getByTestId("search_filter_and_selectstate")).toHaveTextContent("Mine");

        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        await confirmDeleteInAlert(user);

        expect(handleDeleteFilter).toHaveBeenCalledWith("Mine");
        expect(screen.queryByTestId("search_filter_and_selectstate")).not.toBeInTheDocument();
        expect(screen.getByTestId("search_filter_save_span")).toBeInTheDocument();
    });

    it("keeps the selected badge when deletion fails", async () => {
        const user = userEvent.setup();
        const handleDeleteFilter = vi.fn().mockResolvedValue(false);
        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_option_Mine"));
        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        await confirmDeleteInAlert(user);

        expect(screen.getByTestId("search_filter_and_selectstate")).toHaveTextContent("Mine");
    });

    it("does not delete when AlertDialog is cancelled", async () => {
        const user = userEvent.setup();
        const handleSelectFilter = vi.fn();
        const handleDeleteFilter = vi.fn();
        render(
            <SearchFilter
                handleSelectFilter={handleSelectFilter}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );
        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        expect(screen.getByTestId("filter_delete_alert_cancel")).toHaveTextContent("app.forms.cancel");
        await user.click(screen.getByTestId("filter_delete_alert_cancel"));
        expect(handleDeleteFilter).not.toHaveBeenCalled();
        expect(handleSelectFilter).not.toHaveBeenCalled();
        expect(screen.queryByTestId("filter_delete_alert")).not.toBeInTheDocument();
    });

    it("allows keyboard focus and activation of the delete control", async () => {
        const user = userEvent.setup();
        const handleSelectFilter = vi.fn();
        const handleDeleteFilter = vi.fn().mockResolvedValue(true);
        render(
            <SearchFilter
                handleSelectFilter={handleSelectFilter}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        const deleteButton = screen.getByTestId("filter_delete_Mine");
        deleteButton.focus();
        expect(deleteButton).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(screen.getByTestId("filter_delete_alert")).toBeInTheDocument();
        await confirmDeleteInAlert(user);
        expect(handleDeleteFilter).toHaveBeenCalledWith("Mine");
        expect(handleSelectFilter).not.toHaveBeenCalled();
    });

    it("shows the selectedFilter prop as the active saved filter badge", () => {
        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={vi.fn()}
                nameTable="cases"
                dataUser={dataUser}
                selectedFilter="Mine"
            />,
        );

        expect(screen.getByTestId("search_filter_and_selectstate")).toHaveTextContent("Mine");
    });

    it("clears the badge when selectedFilter becomes null", () => {
        const { rerender } = render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={vi.fn()}
                nameTable="cases"
                dataUser={dataUser}
                selectedFilter="Mine"
            />,
        );

        rerender(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={vi.fn()}
                nameTable="cases"
                dataUser={dataUser}
                selectedFilter={null}
            />,
        );

        expect(screen.queryByTestId("search_filter_and_selectstate")).not.toBeInTheDocument();
        expect(screen.getByTestId("search_filter_save_span")).toBeInTheDocument();
    });

    it("filters both preset items and their delete buttons when searching in SearchFilter", async () => {
        const user = userEvent.setup();
        const multiDataUser = {
            filters: {
                application: {
                    agente: {
                        cases: {
                            AlphaFilter: { reference: "1" },
                            BetaFilter: { reference: "2" },
                        },
                    },
                },
            },
        };

        const handleSelectFilter = vi.fn();
        const handleDeleteFilter = vi.fn();

        render(
            <SearchFilter
                handleSelectFilter={handleSelectFilter}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={multiDataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        expect(screen.getByTestId("filter_option_AlphaFilter")).toBeInTheDocument();
        expect(screen.getByTestId("filter_delete_AlphaFilter")).toBeInTheDocument();
        expect(screen.getByTestId("filter_option_BetaFilter")).toBeInTheDocument();
        expect(screen.getByTestId("filter_delete_BetaFilter")).toBeInTheDocument();

        const input = screen.getByTestId("filter_save_input");
        await user.type(input, "Alpha");

        expect(screen.getByTestId("filter_option_AlphaFilter")).toBeInTheDocument();
        expect(screen.getByTestId("filter_delete_AlphaFilter")).toBeInTheDocument();
        expect(screen.queryByTestId("filter_option_BetaFilter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("filter_delete_BetaFilter")).not.toBeInTheDocument();

        await user.clear(input);
        await user.type(input, "NonExisting");

        expect(screen.queryByTestId("filter_option_AlphaFilter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("filter_delete_AlphaFilter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("filter_option_BetaFilter")).not.toBeInTheDocument();
        expect(screen.queryByTestId("filter_delete_BetaFilter")).not.toBeInTheDocument();
        expect(screen.getByTestId("filter_empty")).toBeInTheDocument();

        expect(handleSelectFilter).not.toHaveBeenCalled();
        expect(handleDeleteFilter).not.toHaveBeenCalled();
    });

    it("lists filters from the legacy admin scope when the agente scope has none for that view", async () => {
        const user = userEvent.setup();
        const adminOnlyDataUser = {
            filters: {
                application: {
                    admin: {
                        cases: {
                            Legacy: { reference: "1" },
                        },
                    },
                },
            },
        };

        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={vi.fn()}
                nameTable="cases"
                dataUser={adminOnlyDataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        expect(screen.getByTestId("filter_option_Legacy")).toBeInTheDocument();
    });

    it("does not list admin filters once the agente scope has its own filters for that view", async () => {
        const user = userEvent.setup();
        const bothScopesDataUser = {
            filters: {
                application: {
                    agente: {
                        cases: {
                            OwnFilter: { reference: "1" },
                        },
                    },
                    admin: {
                        cases: {
                            Legacy: { reference: "2" },
                        },
                    },
                },
            },
        };

        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={vi.fn()}
                nameTable="cases"
                dataUser={bothScopesDataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        expect(screen.getByTestId("filter_option_OwnFilter")).toBeInTheDocument();
        expect(screen.queryByTestId("filter_option_Legacy")).not.toBeInTheDocument();
    });

    it("deletes a preset when search filter is applied without selecting it", async () => {
        const user = userEvent.setup();
        const handleSelectFilter = vi.fn();
        const handleDeleteFilter = vi.fn().mockResolvedValue(true);
        const multiDataUser = {
            filters: {
                application: {
                    agente: {
                        cases: {
                            AlphaFilter: { reference: "1" },
                            BetaFilter: { reference: "2" },
                        },
                    },
                },
            },
        };

        render(
            <SearchFilter
                handleSelectFilter={handleSelectFilter}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={multiDataUser}
            />,
        );

        await user.click(screen.getByTestId("btn_search_filter_save"));
        const input = screen.getByTestId("filter_save_input");
        await user.type(input, "Alpha");

        await user.click(screen.getByTestId("filter_delete_AlphaFilter"));
        await confirmDeleteInAlert(user);

        expect(handleDeleteFilter).toHaveBeenCalledWith("AlphaFilter");
        expect(handleSelectFilter).not.toHaveBeenCalled();
    });
});
