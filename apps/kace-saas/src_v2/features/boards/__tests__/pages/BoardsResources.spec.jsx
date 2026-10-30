/* eslint-disable react/prop-types -- los mocks de vi.mock son componentes de usar y tirar. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BoardsResources from "@kace_v2/features/boards/pages/BoardsResources";
import useBoard from "@kace_v2/features/boards/hooks/useBoard.hook";

/*
 * La vista de un tablero es la unica pantalla del modulo que no cuelga de un formulario, asi
 * que su flecha de volver no la aporta ningun componente compartido: vive en la propia pagina
 * y sin este test nada impide que desaparezca al reordenar la barra de acciones.
 */

vi.mock("@kace_v2/features/boards/hooks/useBoard.hook", () => ({ default: vi.fn() }));
vi.mock("@kace_v2/features/boards/hooks/useBoardsTriggerOptions.hook", () => ({
    default: () => ({
        oneScriptId: null,
        showOSModal: false,
        selectedEntity: null,
        setSelectedEntity: vi.fn(),
        triggerOption: vi.fn(),
        setShowOSModal: vi.fn(),
    }),
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardCustomFilter.hook", () => ({
    useBoardCustomFilter: () => ({
        openCustomFilterModal: false,
        setOpenCustomFilterModal: vi.fn(),
        hasCustomFilter: false,
        handleCustomFilter: vi.fn(),
    }),
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardRecordSavedListener.hook", () => ({ default: vi.fn() }));
vi.mock("@kace_v2/features/boards/hooks/useBoardCasesSelection.hook", () => ({
    default: () => ({
        selectedIds: [],
        selectedRows: [],
        toggleRow: vi.fn(),
        togglePage: vi.fn(),
        clearSelection: vi.fn(),
    }),
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardResourceTableFlags.hook", () => ({
    useBoardResourceTableFlags: () => ({
        hasGroupedRecords: false,
        showDeleteAction: false,
        showCasesBulk: false,
        showBulkDelete: false,
    }),
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardDataTableColumns.hook", () => ({
    useBoardDataTableColumns: () => [],
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardDataTableRows.hook", () => ({
    useBoardDataTableRows: () => [],
}));
vi.mock("@kace_v2/features/boards/hooks/useBoardResourceActions.hook", () => ({
    useBoardResourceActions: () => [],
}));
vi.mock("@kace_v2/features/boards/hooks/useQuickAnsFilter.hook", () => ({
    default: () => ({
        ansItems: [],
        ansColumns: [],
        quickAnsFilter: null,
        activeAnsValue: null,
        applyQuickAnsFilter: vi.fn(),
        selectedAnsAlias: "",
        onSelectAnsAlias: vi.fn(),
    }),
}));

vi.mock("@/hooks/useUserInformation", () => ({ default: () => ({ permissionsAuxiliaries: [] }) }));
/*
 * Propio de develop: la pagina lee la configuracion del grupo para el filtro rapido de ANS y
 * los prefijos de tiempo. El hook real pide un QueryClient, que esta prueba no monta.
 */
vi.mock("@/hooks/useConfigAgentData", () => ({ default: () => ({ cases: {} }) }));
vi.mock("@/components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "board-1" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

vi.mock("@kace_v2/shared/ui/organisms/DataTable", () => ({ default: () => <div data-testid="data-table" /> }));
vi.mock("@kace_v2/shared/ui/organisms/DataTablePagination", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/shared/ui/molecules/DataTableFilterModal", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/shared/ui/molecules/ActiveFilterChips", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/shared/ui/molecules/Tooltip", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("@kace_v2/features/boards/components/BoardsOneScriptModal", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/features/boards/components/BoardsCustomFilterModal", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/features/boards/components/BoardCasesBulkToolbar", () => ({ default: () => <div /> }));
vi.mock("@kace_v2/features/boards/components/QuickAnsFilterButtons", () => ({ default: () => <div /> }));

const goToBoardsList = vi.fn();

const boardState = (overrides = {}) => ({
    resources: { isLoading: false, isFetching: false, isError: false, refetch: vi.fn() },
    boardConfig: { id: "board-1", name: "Tablero de pruebas", columns: [] },
    boardResources: [],
    page: 1,
    totalPages: 1,
    totalRecords: 0,
    criteria: { filter: [] },
    canNextPage: false,
    canPreviousPage: false,
    hasUpdate: false,
    hasDelete: false,
    hasExport: false,
    isDownloading: false,
    hasBoardsCreateRegister: false,
    hasBoardsReadRegister: false,
    hasBoardsUpdateRegister: false,
    openFilterModal: false,
    sortConfig: null,
    filterFormValues: {},
    onNextPage: vi.fn(),
    onPreviousPage: vi.fn(),
    onFirstPage: vi.fn(),
    onLastPage: vi.fn(),
    onGoToPage: vi.fn(),
    updateBoard: vi.fn(),
    goToBoardsList,
    handleDelete: vi.fn(),
    handleFilter: vi.fn(),
    handleSort: vi.fn(),
    clearFilters: vi.fn(),
    setOpenFilterModal: vi.fn(),
    handleDownloadBoard: vi.fn(),
    ...overrides,
});

describe("BoardsResources", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useBoard.mockReturnValue(boardState());
    });

    it("ofrece una flecha para volver al listado de tableros", () => {
        render(<BoardsResources />);

        expect(screen.getByTestId("btn_back_boards_resources")).toBeInTheDocument();
    });

    it("al pulsar la flecha vuelve al listado", () => {
        render(<BoardsResources />);

        fireEvent.click(screen.getByTestId("btn_back_boards_resources"));

        expect(goToBoardsList).toHaveBeenCalledTimes(1);
    });

    it("la flecha no envia ningun formulario", () => {
        render(<BoardsResources />);

        expect(screen.getByTestId("btn_back_boards_resources")).toHaveAttribute("type", "button");
    });
});
