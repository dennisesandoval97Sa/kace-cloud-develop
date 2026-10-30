import { Slider } from "@kace/ui-shared"
import { CircleHelp } from "lucide-react"
import { useEffect, useState } from "react"
import { PropTypes } from "prop-types"
import { useTranslation } from "react-i18next"

export const PriorityContainer = ({
    setFieldValue,
    valueField = 99,
    name = ""
}) => {
    const { t } = useTranslation()
    const [currentPriority, setCurrentPriority] = useState([99])
    const handlePriorityChange = (value) => {
        setFieldValue(name, value[0])
        setCurrentPriority(value[0])
    }
    useEffect(() => {
        setCurrentPriority(valueField)
    }, [valueField])
    return (
        <div className="flex flex-col gap-2 border-t border-input p-2">
            <div className="flex gap-2 items-center">
                <h3 className="text-lg">{t("actions.labels.priority")}</h3>
                <CircleHelp size={20} />
            </div>
            <div>
                <div className="w-full flex justify-between mb-4">
                    <span>{t("actions.labels.morePriority")}</span>
                    <span className="font-semibold text-xl">{valueField}</span>
                    <span>{t("actions.labels.lessPriority")}</span>
                </div>
                <Slider
                    defaultValue={[currentPriority]}
                    max={99}
                    step={1}
                    min={1}
                    onValueChange={(e) => {
                        handlePriorityChange(e)
                    }}
                    value={[currentPriority]}
                    id="progress_indicator_priority"
                    data-testid="progress_indicator_priority"
                />
            </div>
        </div>
    )
}

PriorityContainer.propTypes = {
    setFieldValue: PropTypes.func,
    valueField: PropTypes.number,
    name: PropTypes.string
}
