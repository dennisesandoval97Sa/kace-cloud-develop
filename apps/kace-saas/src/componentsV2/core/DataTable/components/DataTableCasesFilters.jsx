import React, { memo } from "react"
import PropTypes from "prop-types"
import { WalletCards } from "lucide-react"
import DataTableCasesButtonFilter from "./DataTableCasesButtonFilter"

const DataTableCasesFilters = ({ filterButtonsConfig, isFetching = false }) => {
    return (
        <div className="flex flex-wrap gap-2 w-full justify-center">
            {filterButtonsConfig.map((button) => (
                <DataTableCasesButtonFilter
                    key={button.id}
                    handleOnClick={button.action}
                    textMessage={button.textMessage}
                    icon={button?.icon ?? <WalletCards />}
                    className={`${button.className} flex gap-2`}
                    disabled={isFetching}
                    btnName={button?.id}
                />
            ))}
        </div>
    )
}

DataTableCasesFilters.propTypes = {
    filterButtonsConfig: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            icon: PropTypes.element.isRequired,
            action: PropTypes.func.isRequired,
            textMessage: PropTypes.string,
            className: PropTypes.string
        })
    ).isRequired,
    isFetching: PropTypes.bool
}

export default memo(DataTableCasesFilters)
