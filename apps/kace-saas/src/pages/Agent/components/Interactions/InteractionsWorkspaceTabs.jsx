import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import PropTypes from "prop-types";
import useAvailableAgentWorkspaces from "./hooks/useAvailableAgentWorkspaces";

const processWorkspaceData = (workspaces) =>
    workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.description,
        value: workspace.id,
    }));

const InteractionsWorkspaceSelect = ({
    selectedWorkspace,
    onSelectWorkspace,
    allWorkspaces,
    onAllWorkspacesChange,
    onAvailabilityResolved,
}) => {
    const { t } = useTranslation();
    const { workspaces, isLoading, isFetched, activeGroupId, hasActiveScope } = useAvailableAgentWorkspaces();
    const combinedWorkspaceData = useMemo(() => processWorkspaceData(workspaces), [workspaces]);
    const selectedWorkspaceData = useMemo(
        () => combinedWorkspaceData.filter((item) => String(item.id) === String(selectedWorkspace)),
        [combinedWorkspaceData, selectedWorkspace],
    );
    const availableWorkspaceIds = useMemo(
        () => combinedWorkspaceData.map((workspace) => String(workspace.id)),
        [combinedWorkspaceData],
    );

    useEffect(() => {
        if (!hasActiveScope || !isFetched) return;
        onAvailabilityResolved?.({ activeGroupId, workspaceIds: availableWorkspaceIds });
    }, [activeGroupId, availableWorkspaceIds, hasActiveScope, isFetched, onAvailabilityResolved]);

    const handleWorkspaceSelect = (selectedId) => {
        onSelectWorkspace(selectedId);
    };

    const handleCheckboxChange = (e) => {
        const checked = e.target.checked;
        onAllWorkspacesChange(checked);
        if (checked) {
            onSelectWorkspace(null);
        }
    };

    return (
        <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="allWorkspaces"
                    checked={allWorkspaces}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="allWorkspaces" className="text-sm font-medium cursor-pointer">
                    {t("interactions.title.allWorkspaces")}
                </label>
            </div>

            <div className="w-80">
                <MultiSelect
                    type="input"
                    selectedData={selectedWorkspaceData}
                    options={combinedWorkspaceData}
                    isLoading={isLoading}
                    onSelectOption={handleWorkspaceSelect}
                    placeholder={isLoading ? t("genericTexts.loading") : t("interactions.searchWorkspace")}
                    hiddenSelectedAll
                    single
                    isDisabled={allWorkspaces || !hasActiveScope}
                />
            </div>
        </div>
    );
};

InteractionsWorkspaceSelect.propTypes = {
    selectedWorkspace: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onSelectWorkspace: PropTypes.func.isRequired,
    allWorkspaces: PropTypes.bool.isRequired,
    onAllWorkspacesChange: PropTypes.func.isRequired,
    onAvailabilityResolved: PropTypes.func,
};

export default InteractionsWorkspaceSelect;
