import { format } from "date-fns";
import { es } from "date-fns/locale";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";
import { getInteractionStatus, getTextStatusColor } from "./utils/stateAndColor";

const InteractionsList = ({
    workspaceId,
    interactions = [],
    isLoading = false,
    isFetching = false,
    totalRecords = interactions.length,
    pagination = null,
    selectedInteraction,
    onSelectInteraction,
}) => {
    const { t } = useTranslation();
    const showPagination = pagination && pagination.totalPages > 1;
    const canSelectInteraction = typeof onSelectInteraction === "function";

    return (
        <div className="border rounded-lg bg-white overflow-hidden flex h-[calc(100vh-330px)] flex-col">
            <div className="bg-gray-50 px-4 py-3 border-b">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">{t("interactions.title.list")}</h3>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                        {totalRecords}
                    </span>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t("interactions.list.date")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t("interactions.list.subject")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan="2" className="px-4 py-8 text-center text-gray-500">
                                    {t("event_logs.loading")}
                                </td>
                            </tr>
                        ) : interactions?.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="px-4 py-8 text-center text-gray-500">
                                    {!workspaceId
                                        ? t("interactions.list.selectWorkspace")
                                        : t("interactions.list.noResults")}
                                </td>
                            </tr>
                        ) : (
                            interactions?.map((interaction) => (
                                <tr
                                    key={interaction.id}
                                    onClick={canSelectInteraction ? () => onSelectInteraction(interaction) : undefined}
                                    className={`transition-colors ${
                                        canSelectInteraction ? "cursor-pointer hover:bg-purple-50" : ""
                                    } ${selectedInteraction?.id === interaction.id ? "bg-purple-100" : ""}`}
                                >
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {format(
                                            new Date(interaction.fecha || interaction.created_at),
                                            "dd/MM/yyyy HH:mm",
                                            { locale: es },
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {interaction.asunto || interaction.subject || interaction.description}
                                            </span>

                                            <span className={`text-xs mt-1 ${getTextStatusColor(interaction)}`}>
                                                {getInteractionStatus(interaction, t)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showPagination && (
                <div className="flex items-center justify-between gap-2 border-t bg-gray-50 px-3 py-2">
                    <div className="flex flex-col text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                            {t("interactions.pagination.pageOf", {
                                page: pagination.page,
                                totalPages: pagination.totalPages,
                                defaultValue: `Página ${pagination.page} de ${pagination.totalPages}`,
                            })}
                        </span>
                        <span>
                            {t("interactions.pagination.total", {
                                totalRecords,
                                defaultValue: `${totalRecords} interacciones`,
                            })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {pagination.onJumpBackward && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={pagination.onJumpBackward}
                                disabled={!pagination.canPreviousPage || isFetching}
                                id="btn_interactions_jump_backward"
                                data-testid="btn_interactions_jump_backward"
                                aria-label={t("dataTable.pagination.jumpBackwardAriaLabel")}
                            >
                                {t("dataTable.pagination.jumpBackward")}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={pagination.onPreviousPage}
                            disabled={!pagination.canPreviousPage || isFetching}
                            id="btn_interactions_previous_page"
                        >
                            {t("button.previous")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={pagination.onNextPage}
                            disabled={!pagination.canNextPage || isFetching}
                            id="btn_interactions_next_page"
                        >
                            {t("button.next")}
                        </Button>
                        {pagination.onJumpForward && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={pagination.onJumpForward}
                                disabled={!pagination.canNextPage || isFetching}
                                id="btn_interactions_jump_forward"
                                data-testid="btn_interactions_jump_forward"
                                aria-label={t("dataTable.pagination.jumpForwardAriaLabel")}
                            >
                                {t("dataTable.pagination.jumpForward")}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

InteractionsList.propTypes = {
    workspaceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    interactions: PropTypes.array,
    isLoading: PropTypes.bool,
    isFetching: PropTypes.bool,
    totalRecords: PropTypes.number,
    pagination: PropTypes.shape({
        page: PropTypes.number.isRequired,
        totalPages: PropTypes.number.isRequired,
        onPreviousPage: PropTypes.func.isRequired,
        canPreviousPage: PropTypes.bool.isRequired,
        onNextPage: PropTypes.func.isRequired,
        canNextPage: PropTypes.bool.isRequired,
        onJumpBackward: PropTypes.func,
        onJumpForward: PropTypes.func,
    }),
    selectedInteraction: PropTypes.object,
    onSelectInteraction: PropTypes.func,
};

export default InteractionsList;
