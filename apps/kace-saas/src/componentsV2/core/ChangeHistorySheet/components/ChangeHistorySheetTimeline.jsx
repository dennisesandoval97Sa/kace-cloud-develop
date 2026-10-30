import React from "react"
import PropTypes from "prop-types"
import { Separator } from "@/components/ui-shared"
import ChangeHistorySheetTimelineItem from "./ChangeHistorySheetTimelineItem"

const ChangeHistorySheetTimeline = ({ data = [] }) => {
    return (
        <div className="relative pl-8">
            <Separator orientation="vertical" className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />
            <ul className="space-y-8">
                {data.map(
                    (
                        {
                            id,
                            attribute,
                            updated_at,
                            updated_by,
                            changed_attribute,
                            changed_attribute_type,
                            original_attribute,
                            original_attribute_type
                        },
                        index
                    ) => (
                        <ChangeHistorySheetTimelineItem
                            key={id}
                            number={data.length - index}
                            date={updated_at}
                            attribute={attribute}
                            changedAttribute={changed_attribute}
                            changedAttributeType={changed_attribute_type}
                            originalAttribute={original_attribute}
                            originalAttributeType={original_attribute_type}
                            updatedBy={updated_by}
                        />
                    )
                )}
            </ul>
        </div>
    )
}

ChangeHistorySheetTimeline.propTypes = {
    data: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            attribute: PropTypes.string.isRequired,
            updated_at: PropTypes.string.isRequired,
            updated_by: PropTypes.string.isRequired,
            changed_attribute: PropTypes.string.isRequired,
            changed_attribute_type: PropTypes.oneOf(["string", "json"]).isRequired,
            original_attribute: PropTypes.string.isRequired,
            original_attribute_type: PropTypes.oneOf(["string", "json"]).isRequired
        })
    )
}

export default ChangeHistorySheetTimeline
