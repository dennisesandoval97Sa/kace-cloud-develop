import { useMemo } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";
import { deleteAuxiliaryRecord } from "@kace_v2/features/boards/services/boards.service";
import {
    hasAuxiliaryDeletePermission,
    isDisallowedAuxiliaryDelete,
} from "@kace_v2/features/boards/utils/auxiliary-delete-permission.util";
import { hasMainEntityDependency } from "@kace_v2/features/boards/utils/auxiliary-dependency.util";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";

export const useBoardResourceActions = ({
    boardConfig,
    hasGroupedRecords,
    hasBoardsReadRegister,
    hasBoardsUpdateRegister,
    showDeleteAction,
    permissionsAuxiliaries,
    refetchResources,
    triggerOption,
    scope,
}) => {
    const { t } = useTranslation();

    return useMemo(() => {
        const options = boardConfig?.options || [];
        const primaryEntity = boardConfig?.primary_entity;
        const isCasesEntity = primaryEntity === "cases";
        const isBoardsCasesView = primaryEntity?.startsWith("boards_") && primaryEntity?.includes("cases");

        const showViewCase =
            hasBoardsReadRegister &&
            boardConfig?.can_view_record !== false &&
            (isCasesEntity || isBoardsCasesView) &&
            !hasGroupedRecords;

        const baseOptions = options.map((option, index) => ({
            label: option.label || `${option.type} ${index + 1}`,
            fn: ({ row }) => {
                const resource_id = row.id;
                if (!resource_id) return;

                if (option.requires_confirmation) {
                    Swal.fire({
                        title: "Esta seguro de ejecutar esta accion?",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: "#3085d6",
                        cancelButtonColor: "#d33",
                        confirmButtonText: "Si ejecutar",
                        cancelButtonText: "Cancelar",
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            triggerOption(option.type, option.ref_id, resource_id);
                        }
                    });
                } else {
                    triggerOption(option.type, option.ref_id, resource_id);
                }
            },
        }));

        const showEdit = hasBoardsUpdateRegister && !hasGroupedRecords && boardConfig?.can_edit_record !== false;

        const canDeleteAux = hasAuxiliaryDeletePermission(permissionsAuxiliaries, boardConfig?.primary_entity);
        const isDisallowedAux = isDisallowedAuxiliaryDelete(boardConfig?.primary_entity);

        const includeBoardIdInEditTrigger = scope === BOARD_TABLE_SCOPE.AGENT;

        const deleteRecordAction = showDeleteAction
            ? [
                  {
                      label: t("boards.boardView.deleteRecord"),
                      fn: async ({ row }) => {
                          const resource_id = row.id;
                          if (!resource_id) return;
                          const result = await Swal.fire({
                              title: t("boards.boardView.deleteRecordConfirm"),
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonColor: "#3085d6",
                              cancelButtonColor: "#d33",
                              confirmButtonText: t("boards.boardView.deleteRecordConfirmYes"),
                              cancelButtonText: t("boards.boardView.deleteRecordConfirmCancel"),
                          });
                          if (!result.isConfirmed) return;
                          Swal.fire({
                              title: t("boards.boardView.deleteRecordLoading"),
                              allowOutsideClick: false,
                              allowEscapeKey: false,
                              showConfirmButton: false,
                              didOpen: () => {
                                  Swal.showLoading();
                              },
                          });
                          try {
                              await deleteAuxiliaryRecord(boardConfig.primary_entity, resource_id);
                              toast.success(t("boards.boardView.deleteRecordSuccess"));
                              refetchResources();
                          } catch (error) {
                              const publicErrorCode = findPublicErrorCode(
                                  error?.response?.data?.data?.code,
                                  error?.response?.data?.code,
                              );
                              const backendMsg = error?.response?.data?.message ?? "";
                              if (
                                  publicErrorCode === PUBLIC_ERROR_CODES.AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY ||
                                  backendMsg.includes("vinculado a una entidad principal")
                              ) {
                                  toast.error(t("boards.boardView.deleteRecordDependencyError"));
                              } else {
                                  toast.error(t("boards.boardView.deleteRecordError"));
                              }
                          } finally {
                              Swal.close();
                          }
                      },
                      disabled: ({ row }) => {
                          if (isDisallowedAux) return true;
                          if (!canDeleteAux) return true;
                          return hasMainEntityDependency(row, boardConfig?.columns, boardConfig?.primary_entity);
                      },
                      tooltip: ({ row }) => {
                          if (isDisallowedAux) return t("boards.boardView.deleteRecordDisallowedTooltip");
                          if (!canDeleteAux) return t("boards.boardView.deleteRecordPermissionTooltip");
                          if (hasMainEntityDependency(row, boardConfig?.columns, boardConfig?.primary_entity)) {
                              return t("boards.boardView.deleteRecordDependencyTooltip");
                          }
                          return undefined;
                      },
                  },
              ]
            : [];

        return [
            ...deleteRecordAction,
            ...(showViewCase
                ? [
                      {
                          label: "Ver caso",
                          fn: ({ row }) => triggerOption("VIEWCASE", null, row.id, boardConfig.id),
                      },
                  ]
                : []),
            ...(showEdit
                ? [
                      {
                          label: "Editar",
                          fn: ({ row }) =>
                              includeBoardIdInEditTrigger
                                  ? triggerOption("ONESCRIPT", boardConfig.onescript_form_id, row.id, boardConfig.id)
                                  : triggerOption("ONESCRIPT", boardConfig.onescript_form_id, row.id),
                      },
                  ]
                : []),
            ...baseOptions,
        ];
    }, [
        boardConfig,
        hasGroupedRecords,
        hasBoardsReadRegister,
        hasBoardsUpdateRegister,
        showDeleteAction,
        permissionsAuxiliaries,
        t,
        refetchResources,
        triggerOption,
        scope,
    ]);
};
