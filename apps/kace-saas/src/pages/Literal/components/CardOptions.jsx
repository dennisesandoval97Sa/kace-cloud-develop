import useFieldModalLiteral from "../hooks/useFieldModalLiteral"
import PropTypes from "prop-types"
import { BaseCard } from "./BaseCard"
import { Separator } from "../../../components/ui-shared"
import { useParent } from "../LiteralContext"
import { useEffect } from "react"

const CardOptions = ({ selected }) => {
    const { fieldsData, handleDeleteField, loadingData } = useFieldModalLiteral(
        {
            id: selected.field?.id,
            load: true
        }
    )

    const isEmpty = fieldsData.length === 0
    const { setParentId } = useParent()
    useEffect(() => {
        setParentId("option")
    }, [])

    return (
        <div
            className="relative w-96"
            style={{
                height: "calc(100vh - 10rem)"
            }}
        >
            {selected.field && selected.literal
                ? (
                    <BaseCard
                        isEmpty={isEmpty}
                        fieldsData={fieldsData}
                        title="Opciones de campo"
                        loadingData={loadingData}
                        handleDelete={handleDeleteField}
                        isChild
                        type="option"
                        selected={selected}
                        selectObject={selected}
                    />
                )
                : (
                    <div
                        className={"border-2 border-dashed rounded-md absolute top-0 right-0 h-full w-full flex flex-col justify-evenly items-center text-2xl font-bold text-center text-gray-400"}
                        id="card_opt_empty"
                        data-testid="card_opt_empty"
                    >
                        <Separator orientation="vertical" className="w-2 h-1/4 rounded-full bg-gray-400" />
                        Lista de opciones de campo seleccionado
                        <Separator orientation="vertical" className="w-2 h-1/4 rounded-full bg-gray-400" />
                    </div>
                )}
        </div>
    )
}

CardOptions.propTypes = {
    selected: PropTypes.object
}

export default CardOptions
