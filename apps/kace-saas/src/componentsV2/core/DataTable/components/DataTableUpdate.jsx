import { memo, useMemo } from "react"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"
import { RefreshCcw } from "lucide-react"
import {
    Button,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui-shared"

const DataTableUpdate = ({ onRefresh, isFetching = false }) => {
    const { t } = useTranslation()

    const buttonText = useMemo(
        () => (isFetching ? t("app.states.updating") : t("button.update")),
        [isFetching]
    )

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onRefresh}
                        disabled={isFetching}
                        id="dt_table_filter_update"
                        data-testid="dt_table_filter_update"
                    >
                        <RefreshCcw
                            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                        />
                        <span className="truncate">{buttonText}</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{buttonText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

DataTableUpdate.propTypes = {
    onRefresh: PropTypes.func.isRequired,
    isFetching: PropTypes.bool
}

export default memo(DataTableUpdate)
