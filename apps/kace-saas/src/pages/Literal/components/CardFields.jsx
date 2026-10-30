import useFieldModalLiteral from "../hooks/useFieldModalLiteral"
import PropTypes from "prop-types"
import { BaseCard } from "./BaseCard"
import { Separator } from "../../../components/ui-shared"
import { useParent } from "../LiteralContext"
import { useEffect } from "react"

const CardFields = ({
    selected,
    onChangeSelected
}) => {
    const { fieldsData, handleDeleteField, isLoadingFieldsData } =
        useFieldModalLiteral({
            id: selected.literal?.id,
            load: true
        })
    const isEmpty = fieldsData.length === 0
    const { setParentId } = useParent()
    useEffect(() => {
        setParentId("field")
    }, [])
    return (
        <div
            className="relative w-96"
            style={{
                height: "calc(100vh - 10rem)"
            }}
        >
            {selected.literal
                ? (
                    <BaseCard
                        isEmpty={isEmpty}
                        fieldsData={fieldsData}
                        handleDelete={handleDeleteField}
                        isLoadingFieldsData={isLoadingFieldsData}
                        title="Lista de campos"
                        type="field"
                        selected={selected.field}
                        onChangeSelected={onChangeSelected}
                        isChild={true}
                        selectObject={selected}
                    />
                )
                : (
                    <div
                        className={"border-2 border-dashed rounded-md absolute top-0 right-0 h-full w-full flex flex-col justify-evenly items-center text-2xl font-bold text-center text-gray-400"}
                    >
                        <Separator orientation="vertical" className="w-2 h-1/4 rounded-full bg-gray-400"/>
                        Lista de campos de modelo seleccionado
                        <Separator orientation="vertical" className="w-2 h-1/4 rounded-full bg-gray-400"/>
                    </div>
                )}
        </div>
    )
}

CardFields.propTypes = {
    selected: PropTypes.object,
    onChangeSelected: PropTypes.func
}

export default CardFields
