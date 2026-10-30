import PropTypes from "prop-types"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui-shared"
import ChangeHistorySheetDataDisplay from "./ChangeHistorySheetDataDisplay"

const ChangeHistorySheetTimelineItem = ({
    attribute,
    date = "-",
    updatedBy = "-",
    changedAttribute = "-",
    changedAttributeType = "string",
    originalAttribute = "-",
    originalAttributeType = "string"
}) => {
    return (
        <li className="relative">
            <div className="absolute -left-3 top-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary">
                <div className="w-4 h-4 rounded-full bg-white" />
            </div>
            <div className="space-y-1 min-h-52 flex flex-col justify-between gap-6">
                <div className="h-6 flex flex-col justify-center">
                    <time className="text-sm pl-8 text-gray-500 block">{date}</time>
                </div>
                <Card className="overflow-auto">
                    <CardHeader className="p-4">
                        <h3 className="text-xl font-bold capitalize">{attribute}</h3>
                    </CardHeader>
                    <CardContent className="p-4">
                        {attribute !== "created" && (
                            <div className="flex flex-col gap-2">
                                <ChangeHistorySheetDataDisplay
                                    attributeType={changedAttributeType}
                                    attribute={changedAttribute}
                                />
                                <ChangeHistorySheetDataDisplay
                                    attributeType={originalAttributeType}
                                    attribute={originalAttribute}
                                    isOriginal
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="p-4">
                        <h3 className="text-sm font-semibold">{updatedBy}</h3>
                    </CardFooter>
                </Card>
            </div>
        </li>
    )
}

ChangeHistorySheetTimelineItem.propTypes = {
    attribute: PropTypes.string,
    date: PropTypes.string,
    updatedBy: PropTypes.string,
    changedAttribute: PropTypes.string,
    changedAttributeType: PropTypes.oneOf(["string", "json"]),
    originalAttribute: PropTypes.string,
    originalAttributeType: PropTypes.oneOf(["string", "json"])
}

export default ChangeHistorySheetTimelineItem
