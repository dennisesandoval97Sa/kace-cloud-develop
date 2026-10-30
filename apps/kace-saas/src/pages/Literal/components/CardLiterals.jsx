import PropTypes from "prop-types"
import { BaseCard } from "./BaseCard"
import { useParent } from "../LiteralContext"
import { useEffect } from "react"

const CardLiterals = ({
    literals = [],
    handleDeleteModel,
    onChangeSelected,
    selectedLiteral = {},
    handleLiteral,
    loadingHandle
}) => {
    const isEmpty = literals.length === 0
    const { setParentId } = useParent()
    useEffect(() => {
        setParentId("literal")
    }, [])
    return (
        <BaseCard
            isEmpty={isEmpty}
            fieldsData={literals}
            onChangeSelected={onChangeSelected}
            selected={selectedLiteral.literal}
            handleDelete={handleDeleteModel}
            title="Lista de modelos"
            type="literal"
            handleAction={handleLiteral}
            loadingAction={loadingHandle}
        />
    )
}

CardLiterals.propTypes = {
    literals: PropTypes.array,
    handleDeleteModel: PropTypes.func,
    onChangeSelected: PropTypes.func,
    selectedLiteral: PropTypes.object,
    handleLiteral: PropTypes.func,
    loadingHandle: PropTypes.func
}

export default CardLiterals
