import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "i18next";
import { OPTIONS_FILTERS_TABLE } from "@kace/utils";
import { ICONS_SELECT, MoreHorizontal } from "../../icons";
import { ChevronRight, ChevronDown } from "lucide-react";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DataTableColumnHeader } from "./data-table-column-header-props";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { SheetErrors } from "../../../../../pages/ExportAndImportData/components/SheetErrors";
import DueDateCell from "../../../../../componentsV2/core/TableCellContent/components/DueDateCell";
import { AlertModalShared } from "../alert-modal";
import { formatTestId, isDeleteAction } from "@/utils/src/helpers";
import { getExpandableClassificationLevelsFromRow, getFilledClassificationLevels } from "@/utils/classificationLevels";
import { formatTableDateTime } from "@/utils/main";
import { isDateColumnType } from "@/utils/src/utils/resolveDateColumnNamesFromSchema";
import { EXPANDED_CONTENT_TYPE } from "./expandedContentTypes";

export { getFilledClassificationLevels };

export const getChildClassificationLevels = (row = {}) => getExpandableClassificationLevelsFromRow(row, "nivel1");

function RowActionTable(data, arrayActions, nameElement) {
    const queryClient = useQueryClient();
    const arrayActionsFilter = arrayActions.filter((item) => item?.customizable === false);
    const customizableAction = arrayActions.filter((item) => item?.customizable === true);

    return [
        {
            id: "actions",
            cell: ({ row }) => {
                // NO-SONAR: Se utliza para abrir el DropdownMenu del componenete actions
                const [open, setOpen] = useState(false);
                const resolutionDate = row.original.hasOwnProperty("fecha_resolucion")
                    ? row.original.fecha_resolucion
                    : null;
                if (nameElement) {
                    row.original.id = row.original.group_id;
                }

                return (
                    <DropdownMenu
                        open={open}
                        onOpenChange={(open) => {
                            setOpen(open);
                            queryClient.setQueryData(["selectedCaseData"], {
                                data: row.original,
                                isModalOpen: open,
                            });
                        }}
                    >
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                data-testid={`btn_open_actions_table_${row.original.id}`}
                                id={`btn_open_actions_table_${row.original.id}`}
                            >
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuLabel>{t("gridMain.actions.actions")}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {arrayActionsFilter.map((item) => (
                                <DropdownMenuItem
                                    key={item.name}
                                    id={formatTestId("btn_action_table", `${item.name}_${row.original.id}`)}
                                    data-testid={formatTestId("btn_action_table", `${item.name}_${row.original.id}`)}
                                    className={`${isDeleteAction(item.name, t) && "text-redCustom"}`}
                                    onSelect={(event) => {
                                        if (isDeleteAction(item.name, t)) {
                                            event.preventDefault();
                                        } else {
                                            item.action(row.original.id);
                                        }
                                    }}
                                >
                                    {isDeleteAction(item.name, t) ? (
                                        <AlertModalShared
                                            nameAcceptAction={t("app.forms.delete")}
                                            nameCancelAction={t("app.forms.cancel")}
                                            handleAcceptAction={() => item.action(row.original.id)}
                                            handleCancelAction={() => setOpen(false)}
                                            id={row.original.id}
                                            buttonAction={<div className="w-full h-full">{item.name}</div>}
                                            data-testid={`columns_alert_delete_${row.original.id}`}
                                        />
                                    ) : (
                                        item.name
                                    )}
                                </DropdownMenuItem>
                            ))}
                            {customizableAction.map((item) => {
                                if (
                                    resolutionDate === null &&
                                    (item.name === "Ver caso" ||
                                        item.name === "Re-asignar caso" ||
                                        item.name === "Clonar caso" ||
                                        item.name === "Cerrar caso")
                                ) {
                                    return (
                                        <DropdownMenuItem
                                            onClick={() => item.action(row.original.id, row.original.reference)}
                                            key={item.name}
                                            id={formatTestId("btn_action_table", `${item.name}_${row.original.id}`)}
                                            data-testid={formatTestId(
                                                "btn_action_table",
                                                `${item.name}_${row.original.id}`,
                                            )}
                                        >
                                            {item.name}
                                        </DropdownMenuItem>
                                    );
                                }
                                if (
                                    resolutionDate !== null &&
                                    (item.name === "Re-abrir caso" ||
                                        item.name === "Clonar caso" ||
                                        item.name === "Ver caso")
                                ) {
                                    return (
                                        <DropdownMenuItem
                                            onClick={() => item.action(row.original.id, row.original.reference)}
                                            key={item.name}
                                            id={formatTestId("btn_option", `${item.name}_${row.original.id}`)}
                                            data-testid={formatTestId("btn_option", `${item.name}_${row.original.id}`)}
                                        >
                                            {item.name}
                                        </DropdownMenuItem>
                                    );
                                }
                                if (item.name === "Ver en el mapa") {
                                    return (
                                        <DropdownMenuItem
                                            onClick={() => item.action(row.original)}
                                            key={item.name}
                                            id={formatTestId("btn_option", `${item.name}_${row.original.id}`)}
                                            data-testid={formatTestId("btn_option", `${item.name}_${row.original.id}`)}
                                        >
                                            {item.name}
                                        </DropdownMenuItem>
                                    );
                                }
                                return null;
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
        ...data,
    ];
}

function createColumnsData(arrayNames, arrayNamesWithActions = [], selectComponent, ansDisplayMode = "row") {
    const arrayColumns = arrayNames.map(({ accessorKey, header, isVisible, value }) => {
        const isAction = arrayNamesWithActions.includes(accessorKey);
        if (accessorKey === "icon_class") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    const iconData = ICONS_SELECT.find((icon) => icon.name === row.original.icon_class);

                    if (!iconData || !iconData.component) {
                        return <p>{row.original.icon_class}</p>;
                    }

                    const IconComponent = iconData.component;

                    return <IconComponent className="h-6 w-6" />;
                },
            };
        }
        if (
            accessorKey === "color" ||
            accessorKey === "color_ans_inicial" ||
            accessorKey === "color_ans_intermedio" ||
            accessorKey === "color_ans_final"
        ) {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => (
                    <div
                        style={{
                            backgroundColor: row.original[accessorKey],
                        }}
                        className="h-6 w-6 rounded-full"
                    ></div>
                ),
            };
        }
        if (accessorKey === "descripcion") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    if (row.original.descripcion.length > 27) {
                        return (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <p className="w-48 truncate">{row.original.descripcion}</p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-80">{row.original.descripcion}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    } else {
                        return (
                            <p
                                id={formatTestId("colum_desc", `${row.original.descripcion}`)}
                                data-testid={formatTestId("colum_desc", `${row.original.descripcion}`)}
                            >
                                {row.original.descripcion}
                            </p>
                        );
                    }
                },
            };
        }
        if (accessorKey === "nivel1") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row, table }) => {
                    const classificationLevels = getFilledClassificationLevels(row.original);
                    const childClassificationLevels = getChildClassificationLevels(row.original);
                    const classificationCount = classificationLevels.length;

                    if (childClassificationLevels.length > 0) {
                        return (
                            <div className="flex gap-2 item-center">
                                <div className="flex item-center justify-center border border-greenCustom rounded-full bg-greenCustom/40 text-greenCustom">
                                    <p className="h-auto w-6 flex justify-center items-center font-semibold text-lg">
                                        {classificationCount}
                                    </p>
                                    <button
                                        onClick={(event) => {
                                            const expandedContentMeta = table?.options?.meta;
                                            if (
                                                typeof expandedContentMeta?.getExpandedContentType !== "function" ||
                                                typeof expandedContentMeta?.setExpandedContentType !== "function"
                                            ) {
                                                row.getToggleExpandedHandler()(event);
                                                return;
                                            }

                                            const currentType = expandedContentMeta.getExpandedContentType(row.id);
                                            expandedContentMeta.setExpandedContentType(
                                                row.id,
                                                EXPANDED_CONTENT_TYPE.CLASSIFICATION,
                                            );

                                            if (
                                                row.getIsExpanded() &&
                                                currentType === EXPANDED_CONTENT_TYPE.CLASSIFICATION
                                            ) {
                                                row.toggleExpanded(false);
                                                return;
                                            }

                                            if (!row.getIsExpanded()) {
                                                row.getToggleExpandedHandler()(event);
                                            }
                                        }}
                                        id={`btn_expand_${row.original.id}`}
                                        data-testid={`btn_expand_${row.original.id}`}
                                    >
                                        {row.getIsExpanded() ? (
                                            <ChevronDown id="columns_chevrondown" data-testid="columns_chevrondown" />
                                        ) : (
                                            <ChevronRight
                                                id="columns_chevronright"
                                                data-testid="columns_chevronright"
                                            />
                                        )}
                                    </button>
                                </div>
                                <span className="flex justify-center items-center">{row.original.nivel1}</span>
                            </div>
                        );
                    }
                    return (
                        <div className="flex gap-2 item-center">
                            <div className="flex item-center justify-center border border-greenCustom rounded-full bg-greenCustom/40 text-greenCustom">
                                <p className="h-6 w-6 flex justify-center items-center font-semibold text-lg">
                                    {classificationCount}
                                </p>
                                <ChevronRight
                                    className="opacity-50"
                                    id={`columns_chevronright_${row.original.nivel1}`}
                                    data-testid={`columns_chevronright_${row.original.nivel1}`}
                                />
                            </div>
                            <span className="flex justify-center items-center">{row.original.nivel1}</span>
                        </div>
                    );
                },
            };
        }
        if (accessorKey === "group.nombre") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    return row.original?.group?.nombre;
                },
            };
        }
        if (accessorKey === "one_script.nombre") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    return row.original?.one_script?.nombre;
                },
            };
        }
        if (accessorKey === "error_details") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    return <SheetErrors errorsDetails={row.original.error_details} file={row.original.file_path} />;
                },
            };
        }
        if (accessorKey === "last_updated_at" || accessorKey === "created_at" || accessorKey === "updated_at") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => formatTableDateTime(row.original[accessorKey]),
            };
        }
        if (accessorKey === "fecha_vencimiento") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell:
                    ansDisplayMode === "circle"
                        ? ({ row }) => (
                              <DueDateCell
                                  value={formatTableDateTime(row.original?.fecha_vencimiento)}
                                  ansColor={row.original?.ansColor}
                              />
                          )
                        : ({ row }) => formatTableDateTime(row.original?.fecha_vencimiento),
            };
        }
        if (accessorKey === "status" || accessorKey === "is_active") {
            return {
                accessorKey,
                accessorType: value,
                header,
                isVisible: isVisible ?? true,
                cell: ({ row }) => {
                    const text = row.original.status ?? row.original.is_active;

                    const importStatuses = ["pending", "completed", "rejected", "incompleted", "processing", "failed"];
                    const displayText = importStatuses.includes(text)
                        ? t(`importExport.form.statuses.${text}`, { defaultValue: text })
                        : (text ?? t("app.text.unknown", { defaultValue: "Desconocido" }));

                    let bgColor, textColor;
                    if (text === "processing") {
                        bgColor = "#FFF4E5";
                        textColor = "#B54708";
                    } else if (text === "completed" || text === "Activo") {
                        bgColor = "#E6F4F1";
                        textColor = "#0F766E";
                    } else if (text === "pending") {
                        bgColor = "#EEF2FF";
                        textColor = "#3730A3";
                    } else {
                        bgColor = "#FDE8E4";
                        textColor = "#B42318";
                    }

                    return (
                        <p
                            className="py-1 px-2 rounded-full text-center"
                            style={{ backgroundColor: bgColor, color: textColor }}
                        >
                            {displayText}
                        </p>
                    );
                },
            };
        }

        const isDateColumn =
            isDateColumnType(value) ||
            /^(created_at|updated_at|deleted_at|expired_at|last_updated_at)$/i.test(accessorKey) ||
            /^fecha_/i.test(accessorKey) ||
            /_(at|date)$/i.test(accessorKey);

        return {
            accessorKey,
            accessorType: value,
            header: isAction ? ({ column }) => <DataTableColumnHeader column={column} title={header} /> : header,
            isVisible: isVisible ?? true,
            ...(isDateColumn
                ? {
                      cell: ({ row }) => formatTableDateTime(row.original[accessorKey]),
                  }
                : {}),
            filterFn: (row, columnId, filterValue) => {
                const value = row.getValue(columnId);
                if (filterValue === OPTIONS_FILTERS_TABLE.isNull) {
                    return value === null;
                }
                if (filterValue === OPTIONS_FILTERS_TABLE.isNotNull) {
                    return value !== null;
                }
                if (Array.isArray(filterValue)) {
                    return filterValue.includes(value);
                }
                if (filterValue && typeof filterValue === "string") {
                    return value === filterValue;
                }
                return true;
            },
        };
    });
    if (selectComponent) {
        return [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                        id="select_all"
                        data-testid="select_all"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        data-testid={`select_row_${row.original.id}`}
                        id={`select_row_${row.original.id}`}
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
            },
            ...arrayColumns,
        ];
    } else {
        return arrayColumns;
    }
}

export function createColumns(
    arrayNames = [],
    actions = true,
    arrayNamesWithActions,
    arrayActions,
    selectComponent = false,
    nameElement = null,
    ansDisplayMode = "row",
) {
    const columnsData = createColumnsData(arrayNames, arrayNamesWithActions, selectComponent, ansDisplayMode);
    return actions ? RowActionTable(columnsData, arrayActions, nameElement) : columnsData;
}
