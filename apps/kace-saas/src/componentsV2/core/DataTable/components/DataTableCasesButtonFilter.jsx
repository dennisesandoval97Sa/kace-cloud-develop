import React, { memo } from "react"
import PropTypes from "prop-types"
import {
    Button,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui-shared"
import { useTranslation } from "react-i18next"

const DataTableCasesButtonFilter = ({
    handleOnClick,
    icon,
    className = "",
    textMessage = "",
    disabled = false,
    btnName = "custom",
}) => {
    const { t } = useTranslation()
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        size="sm"
                        className={className}
                        variant="outline"
                        onClick={() => handleOnClick()}
                        disabled={disabled}
                        id={`btn_table_cases_filter_${btnName}`}
                        data-testid={`btn_table_cases_filter_${btnName}`}
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t(textMessage)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider >
    )
}

DataTableCasesButtonFilter.propTypes = {
    handleOnClick: PropTypes.func.isRequired,
    icon: PropTypes.element.isRequired,
    className: PropTypes.string,
    textMessage: PropTypes.string,
    disabled: PropTypes.bool,
    btnName: PropTypes.string
}

export default memo(DataTableCasesButtonFilter)
