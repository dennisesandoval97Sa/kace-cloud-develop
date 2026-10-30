import { t } from "i18next"
import { PropTypes } from "prop-types"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@kace/ui-shared"

export const AdminCaseTextContainerItem = ({ label, item }) => {
    return (
        <div className="flex items-center w-full gap-2" id="text_container_item" data-testid="text_container_item">
            <span className="font-semibold" id="text_container_item_label" data-testid="text_container_item_label">{label} </span>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger id="tooltip_trigger_text_container" data-testid="tooltip_trigger_text_container">
                        <p className="w-48 truncate text-left" id="text_container_item_value" data-testid="text_container_item_value">
                            {item || t("case.transitions.noData")}
                        </p>
                    </TooltipTrigger>
                    <TooltipContent id="tooltip_content_text_container" data-testid="tooltip_content_text_container">
                        {item || t("case.transitions.noData")}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

AdminCaseTextContainerItem.propTypes = {
    label: PropTypes.string.isRequired,
    item: PropTypes.string
}
