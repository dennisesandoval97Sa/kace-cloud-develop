import PropTypes from "prop-types"
import { createContext, useContext, useState, useMemo } from "react"

const ParentContext = createContext(undefined)

export const LiteralProvider = ({ children }) => {
    const [parentId, setParentId] = useState(null)
    const [open, setOpen] = useState(false)

    const contextValue = useMemo(() => ({
        parentId,
        setParentId,
        open,
        setOpen
    }), [parentId, setParentId, open, setOpen]);

    return (
        <ParentContext.Provider value={contextValue}>
            {children}
        </ParentContext.Provider>
    )
}

LiteralProvider.propTypes = {
    children: PropTypes.node.isRequired
}

export const useParent = () => {
    const context = useContext(ParentContext)
    if (!context) {
        throw new Error("useParent debe usarse dentro de un LiteralProvider")
    }
    return context
}
