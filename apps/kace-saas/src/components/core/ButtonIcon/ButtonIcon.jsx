import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '../../../components/ui-shared/index.js'
import { PropTypes } from "prop-types"

const ButtonIcon = ({ children, onClick, tooltip, ...props }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button onClick={() => { if(onClick) onClick() }} variant="outline" {...props}>
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

ButtonIcon.propTypes = {
    children: PropTypes.node,
    onClick: PropTypes.func,
    tooltip: PropTypes.string
}


export default ButtonIcon;