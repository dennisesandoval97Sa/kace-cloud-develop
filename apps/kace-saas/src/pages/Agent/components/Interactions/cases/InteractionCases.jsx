import PropTypes from "prop-types";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";
import InteractionSelectCases from "./InteractionSelectCases";

const InteractionCases = ({ interactionId, showAssociateCases, setShowAssociateCases }) => {
    if (!showAssociateCases) return null;

    const { t } = useTranslation();

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowAssociateCases(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                aria-label={t("button.close")}
            >
                <X className="w-4 h-4" />
            </Button>

            <InteractionSelectCases interactionId={interactionId} onConfirm={() => setShowAssociateCases(false)} />
        </>
    );
};

InteractionCases.propTypes = {
    interactionId: PropTypes.string,
    showAssociateCases: PropTypes.bool.isRequired,
    setShowAssociateCases: PropTypes.func.isRequired,
};
export default InteractionCases;
