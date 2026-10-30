import PropTypes from "prop-types";
import InputCard from "@/components/core/Cards/InputCard";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkSpaceMove } from "./hooks/useWorkSpaceMove";
import useAgentMoveWorkspaceDestinations from "../hooks/useAgentMoveWorkspaceDestinations";
import { isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";

const MoveWorkspaceInline = ({ currentWorkspaceId, interactionId, onConfirm, activeGroupId }) => {
    const { t } = useTranslation();
    const [workspaceDestino, setWorkspaceDestino] = useState("");

    const { moveInteractionToWorkspace, isUpdatingInteractions } = useWorkSpaceMove(interactionId, activeGroupId);
    const { workspaces, isLoading, hasActiveScope } = useAgentMoveWorkspaceDestinations({
        interactionId,
        activeGroupId,
    });
    const options = workspaces
        .filter(
            (workspace) =>
                String(workspace.id) !== String(currentWorkspaceId) && !isSystemInboxWorkspaceId(workspace.id),
        )
        .map((workspace) => ({ id: workspace.id, label: workspace.description, value: workspace.id }));
    const selectedData = options.filter((workspace) => String(workspace.id) === String(workspaceDestino));

    const isDisabled =
        !hasActiveScope || !workspaceDestino || workspaceDestino === currentWorkspaceId || isUpdatingInteractions;

    const handleMove = async () => {
        try {
            await moveInteractionToWorkspace(
                { workspaceId: workspaceDestino },
                {
                    onSuccess: async () => {
                        await onConfirm?.(interactionId, workspaceDestino);
                    },
                },
            );
        } catch {
            // useGeneralMutation preserves the server error feedback and the picker stays open.
        }
    };

    return (
        <div className="border rounded-lg p-4 bg-gray-50 flex items-end gap-4">
            <InputCard className="flex-1">
                <MultiSelect
                    type="input"
                    selectedData={selectedData}
                    options={options}
                    isLoading={isLoading}
                    onSelectOption={setWorkspaceDestino}
                    placeholder={isLoading ? t("genericTexts.loading") : t("interactions.detail.workspacedestination")}
                    hiddenSelectedAll
                    single
                    isDisabled={!hasActiveScope || isUpdatingInteractions}
                />
            </InputCard>

            <button
                type="button"
                className={`px-4 py-2 text-sm rounded-md transition
                    ${
                        isDisabled
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                disabled={isDisabled}
                onClick={handleMove}
            >
                {isUpdatingInteractions ? t("common.saving") : t("interactions.detail.move")}
            </button>
        </div>
    );
};

MoveWorkspaceInline.propTypes = {
    interactionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    currentWorkspaceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onConfirm: PropTypes.func,
    activeGroupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default MoveWorkspaceInline;
