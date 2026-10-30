import PropTypes from "prop-types";
import InputCard from "@/components/core/Cards/InputCard";
import { SelectByUrl } from "@/components/core/SelectByUrl/SelectByUrl";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAssociateInteractionCases } from "./hooks/useAssociateInteractionCases";
import { Button } from "@/components/ui-shared";

const InteractionSelectCases = ({ interactionId, onConfirm }) => {
    const { t } = useTranslation();
    const [selectedCase, setSelectedCase] = useState("");

    const { associateInteractionCases, isPending } = useAssociateInteractionCases(interactionId);

    const isDisabled = !selectedCase || isPending;

    const handle = () => {
        associateInteractionCases(
            { caso_id: selectedCase },
            {
                onSuccess: () => {
                    onConfirm?.(interactionId, selectedCase);
                },
            },
        );
    };

    return (
        <div className="border rounded-lg p-4 bg-gray-50 flex items-end gap-4">
            <InputCard className="flex-1">
                <SelectByUrl
                    name="cases_id"
                    url={URL_AND_KEYS.cases.url}
                    itemLabel="reference"
                    label={t("interactions.cases.selectCases")}
                    value={selectedCase}
                    setFieldValue={(_, value) => {
                        setSelectedCase(value);
                    }}
                    error={null}
                    touched={false}
                    keyQuery="workspacesRequest"
                />
            </InputCard>

            <Button
                variant="outline"
                size="sm"
                type="button"
                className={`px-4 py-2 text-sm rounded-md transition
                    ${
                        isDisabled
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                disabled={isDisabled}
                onClick={handle}
            >
                {isPending ? t("button.sending") : t("interactions.cases.accept")}
            </Button>
        </div>
    );
};

InteractionSelectCases.propTypes = {
    interactionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    currentWorkspaceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onConfirm: PropTypes.func,
};

export default InteractionSelectCases;
