import React from "react"
import PropTypes from "prop-types"
import { Label } from "@/components/ui-shared"

const DataTableFilterInputBaseLayout = ({ label = "", children = <></> }) => {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex w-full justify-between items-center">
                <Label className="text-right flex justify-end">{label}</Label>
            </div>
            {children}
        </div>
    )
}

DataTableFilterInputBaseLayout.propTypes = {
    label: PropTypes.string,
    children: PropTypes.node
}

export default DataTableFilterInputBaseLayout
