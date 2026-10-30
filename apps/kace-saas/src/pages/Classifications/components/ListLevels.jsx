import { ScrollArea, Input, Button, Label } from "@kace/ui-shared"
import InputCard from "../../../components/core/Cards/InputCard"
import { PropTypes } from "prop-types"
import { CircleX } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"

export const ListLevels = ({
    listLevels = [],
    setLevelList,
    setFieldValues,
    setValues,
    values = {},
    errors = {}
}) => {
    const { t } = useTranslation()
    const configAgent = useSelector((state) => state.generalSetup.configAgent)
    const { classifications } = configAgent.AgentNameFields
    const handleDeleteLevel = (level) => {
        const newLevelList = listLevels.filter((l) => l !== level)
        if (newLevelList.length === 0) {
            toast.info(t("classification.form.alerts.minimumOptions"))
            return
        }
        const object = newLevelList.reduce((acc, value, index) => {
            acc[`nivel${index + 1}`] = value
            return acc
        }, {})
        setLevelList(newLevelList)
        const obj1Keys = Object.keys(values).filter((key) =>
            key.startsWith("nivel")
        )
        Object.keys(values).forEach((key) => {
            if (obj1Keys.includes(key)) {
                values[key] = object[key] || ""
            }
        })
        setValues(values)
    }
    const handleUpdateValue = (value, level) => {
        setFieldValues(`nivel${level + 1}`, value)
    }
    return (
        <ScrollArea
            className="max-h-96 border border-input rounded-md p-2"
            data-testid="scrollAreaLevels"
        >
            {listLevels.length === 0 && (
                <p className="text-center text-gray-500 my-2">
                    {t("classification.form.thereAreNotLevels")}
                </p>
            )}
            {listLevels.map((level, index) => {
                const fieldName = `nivel${index + 1}`;
                const error = errors[fieldName];

                return (
                    <InputCard key={level} className="pb-2">
                        <div className="px-2 relative">
                            <div className="flex items-center justify-between mb-1">
                                <Label className="ml-1" id={`input_list_level${Object.values(classifications)[index]}`}
                                    data-testid={`input_list_level${Object.values(classifications)[index]}`}
                                >
                                    {Object.values(classifications)[index]}
                                </Label>
                                {error && (
                                    <span className="text-sm text-red-500 ml-2">{error}</span>
                                )}
                            </div>
                            <Input
                                type="text"
                                label={`${t("classification.form.level")}${index + 1}`}
                                placeholder={`${t("classification.form.placeholder.inputListLevels")}${index + 1}`}
                                className={`flex flex-col items-start justify-start text-start ${error ? "border-red-500" : ""
                                    }`}
                                defaultValue={level}
                                onChange={(e) =>
                                    handleUpdateValue(e.target.value, index)
                                }
                                data-testid={`input_nivel_${index + 1}`}
                                name="levels_text"
                            />

                            <Button
                                className="absolute bottom-0 right-3 rounded-full"
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteLevel(level)}
                                data-testid={`btn_delete_nivel_${index + 1}`}
                                id={`btn_delete_nivel_${index + 1}`}
                            >
                                <CircleX />
                            </Button>
                        </div>
                    </InputCard>
                );
            })}
        </ScrollArea >
    )
}

ListLevels.propTypes = {
    listLevels: PropTypes.array.isRequired,
    setLevelList: PropTypes.func.isRequired,
    setFieldValues: PropTypes.func,
    setValues: PropTypes.func,
    values: PropTypes.object,
    errors: PropTypes.object
}
