import { useMemo } from "react";
import { WalletCards, FolderOpen, FolderX, FolderClosed } from "lucide-react";

const useCasesFiltersConfig = ({
    handleClearFilters = () => {},
    handleApplyFilters = () => {},
    viewPrefix = "",
    isCustomViewEnabled = false,
}) => {
    const casesFiltersConfig = useMemo(
        () => [
            {
                id: "all_cases",
                textMessage: "app.title.allCases",
                icon: <WalletCards />,
                className: "flex gap-2",
                action: () => handleClearFilters(),
            },
            {
                id: "open_cases",
                textMessage: "app.title.caseOpen",
                icon: <FolderOpen />,
                className: "bg-blueCustom hover:bg-blueCustom/80",
                action: () =>
                    handleApplyFilters({
                        open_cases: {
                            field: `${viewPrefix}fecha_resolucion`,
                            operator: "null",
                            type: "AND",
                            value: "null",
                        },
                    }),
            },
            {
                id: "closed_cases",
                textMessage: "app.title.caseClose",
                icon: <FolderClosed />,
                className: "bg-redCustom hover:bg-redCustom/80",
                action: () =>
                    handleApplyFilters({
                        closed_cases: {
                            field: `${viewPrefix}fecha_resolucion`,
                            operator: "notNull",
                            type: "AND",
                            value: "null",
                        },
                    }),
            },
            ...(isCustomViewEnabled
                ? []
                : [
                      {
                          id: "inactive_users",
                          textMessage: "app.title.caseUserInactive",
                          icon: <FolderX />,
                          className: "bg-yellowCustom hover:bg-yellowCustom/80",
                          action: () =>
                              handleApplyFilters({
                                  inactive_users: {
                                      field: "responsable.is_active",
                                      operator: "neq",
                                      type: "AND",
                                      value: 1,
                                  },
                              }),
                      },
                  ]),
        ],
        [handleClearFilters, handleApplyFilters, viewPrefix, isCustomViewEnabled],
    );

    return { casesFiltersConfig };
};

export default useCasesFiltersConfig;
