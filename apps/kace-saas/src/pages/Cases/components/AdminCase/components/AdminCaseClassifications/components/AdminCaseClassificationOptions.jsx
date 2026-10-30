import { KField, SelectForm } from "@kace/ui-shared"
import PropTypes from "prop-types"
import useAdminCaseUserInfo from "../../../hooks/useAdminCaseUserInfo"
import { ScrollArea } from "@/components/ui-shared"

const AdminCaseClassificationOptions = ({
    options,
    nivel = "nivel1",
    selectedOptions,
    handleSelect,
    classifications
}) => {
    const { userCanEditCase } = useAdminCaseUserInfo()
    if (!options || options.length === 0) {
        return null
    }

    const label = Object.entries(classifications).find(([key]) =>
        key.includes(nivel.slice(-1))
    )?.[1]

    const selectedOption = selectedOptions[nivel]
        ? options.find((opt) => opt.value === selectedOptions[nivel])
        : null

    const hasNestedOptions = selectedOption?.options?.length > 0
    const nextNivel = `nivel${parseInt(nivel.replace("nivel", "")) + 1}`

    return (
        <ScrollArea className="flex flex-col gap-2 overflow-auto max-h-[30rem] py-4" id={`classification_scroll_area_${nivel}`} data-testid={`classification_scroll_area_${nivel}`}>
            <KField>
                <SelectForm
                    label={label}
                    name={nivel}
                    options={options}
                    value={selectedOptions[nivel] || ""}
                    handle={(selectedValue, _) =>
                        handleSelect(nivel, selectedValue, true)
                    }
                    disabled={!userCanEditCase}
                    className="flex flex-col items-start justify-start text-start w-auto"
                    id={`select_form_${nivel}`}
                    data-testid={`select_form_${nivel}`}
                />
            </KField>
            {selectedOption && hasNestedOptions && (
                <AdminCaseClassificationOptions
                    options={selectedOption.options}
                    nivel={nextNivel}
                    selectedOptions={selectedOptions}
                    handleSelect={handleSelect}
                    classifications={classifications}
                />
            )}
        </ScrollArea>
    )
}

AdminCaseClassificationOptions.propTypes = {
    options: PropTypes.array,
    nivel: PropTypes.string,
    selectedOptions: PropTypes.object,
    handleSelect: PropTypes.func,
    classifications: PropTypes.object
}

export default AdminCaseClassificationOptions;
