import { format } from "date-fns";
import { es } from "date-fns/locale";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const STATUS_COLOR_MAP = {
    Urgente: "text-red-600",
    Pendiente: "text-yellow-600",
    Abierta: "text-blue-600",
};

const EmailList = ({
    workspaceId,
    interactions = [],
    isLoading = false,
    selectedType,
    searchTerm,
    selectedInteraction,
    onSelectInteraction,
}) => {
    const { t } = useTranslation();

    const filteredInteractions = interactions.filter((interaction) => {
        const matchesType = selectedType === "Todas" || interaction.status === selectedType;
        const matchesSearch = interaction.subject?.toLowerCase().includes(searchTerm?.toLowerCase());
        return matchesType && matchesSearch;
    });

    return (
        <div className="border rounded-lg bg-white overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">{t("interactions.list.title")}</h3>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                        {filteredInteractions?.length}
                    </span>
                </div>
            </div>

            <div className="overflow-auto h-[calc(100vh-330px)]">
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
                                    {t("common.loading")}
                                </td>
                            </tr>
                        ) : filteredInteractions?.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="px-4 py-8 text-center text-gray-500">
                                    {!workspaceId
                                        ? t("interactions.list.selectWorkspace")
                                        : t("interactions.list.noResults")}
                                </td>
                            </tr>
                        ) : (
                            filteredInteractions.map((interaction) => {
                                const statusClass = STATUS_COLOR_MAP[interaction.status] ?? "text-gray-600";

                                return (
                                    <tr
                                        key={interaction.id}
                                        onClick={() => onSelectInteraction(interaction)}
                                        className={`cursor-pointer hover:bg-purple-50 transition-colors ${
                                            selectedInteraction?.id === interaction.id ? "bg-purple-100" : ""
                                        }`}
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
                                                    {interaction.asunto ||
                                                        interaction.subject ||
                                                        interaction.description}
                                                </span>

                                                <span className={`text-xs mt-1 ${statusClass}`}>
                                                    {interaction.status}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

EmailList.propTypes = {
    workspaceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    interactions: PropTypes.array,
    isLoading: PropTypes.bool,
    selectedType: PropTypes.string.isRequired,
    searchTerm: PropTypes.string.isRequired,
    selectedInteraction: PropTypes.object,
    onSelectInteraction: PropTypes.func.isRequired,
};

export default EmailList;
