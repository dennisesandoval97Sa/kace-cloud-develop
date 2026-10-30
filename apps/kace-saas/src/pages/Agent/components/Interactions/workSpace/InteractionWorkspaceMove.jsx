import PropTypes from "prop-types";
import { X } from "lucide-react";
import MoveWorkspaceInline from "./MoveWorkspaceInline";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";

const InteractionWorkspaceMove = ({
    interaction,
    showMoveWorkspace,
    setShowMoveWorkspace,
    canMoveWorkspace = false,
    activeGroupId,
    onInteractionMoved,
}) => {
    const { t } = useTranslation();

    if (!canMoveWorkspace) {
        return null;
    }

    if (!showMoveWorkspace) {
        return (
            <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowMoveWorkspace(true)}
                className="text-sm text-gray-800 hover:underline font-medium items-center justify-center whitespace-nowrap "
            >
                {t("interactions.detail.workspacedestination")}
            </Button>
        );
    }
    return (
        <div className="flex gap-2 relative bg-white border border-gray-200 rounded-lg shadow-sm ">
            <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowMoveWorkspace(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                aria-label={t("common.close")}
            >
                <X className="w-4 h-4" />
            </Button>

            <MoveWorkspaceInline
                interactionId={interaction?.id}
                currentWorkspaceId={interaction?.workspace_id}
                onConfirm={async (interactionId, workspaceId) => {
                    await onInteractionMoved?.(interactionId, workspaceId);
                    setShowMoveWorkspace(false);
                }}
                activeGroupId={activeGroupId}
            />
        </div>
    );
};

InteractionWorkspaceMove.propTypes = {
    interaction: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

        workspace_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),

    showMoveWorkspace: PropTypes.bool.isRequired,

    setShowMoveWorkspace: PropTypes.func.isRequired,

    canMoveWorkspace: PropTypes.bool,
    activeGroupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onInteractionMoved: PropTypes.func,
};
export default InteractionWorkspaceMove;
