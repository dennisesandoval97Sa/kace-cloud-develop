import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "../ui/tooltip"
import { Button } from "../ui/button"
import { PropTypes } from "prop-types"
import { formatTestId } from "@/utils/src/helpers"

export const ButtonFilter = ({
    handleOnClick,
    icon = <></>,
    textMessage = "",
    className = "",
    disabled = false
}) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className={className}
                        variant="outline"
                        onClick={() => {
                            if (handleOnClick) {
                                handleOnClick()
                            }
                        }}
                        data-testid={formatTestId("btn_filter", `${textMessage}`)}
                        id={formatTestId("btn_filter", `${textMessage}`)}
                        disabled={disabled}
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{textMessage}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

ButtonFilter.propTypes = {
    handleOnClick: PropTypes.func,
    icon: PropTypes.element,
    textMessage: PropTypes.string,
    className: PropTypes.string,
    disabled: PropTypes.bool
}
