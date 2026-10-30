import { AlertCircle } from "lucide-react"
import React from "react"
import PropTypes from "prop-types"
import { Button } from "@kace/ui-shared"

export const ErrorGetData = ({ refetch }) => {
    return (
        <div className="flex flex-col items-center justify-center w-full p-6 bg-background rounded-md shadow-md border border-redCustom gap-2">
            <div>
                <AlertCircle className="h-24 w-24 text-red-700" />
            </div>
            <h2 className="text-xl font-bold text-redCustom">No se pudo cargar la información</h2>
            <div className="flex items-center space-x-3 text-redCustom">
                <span>Hubo un problema al obtener la información. Por favor, intenta recargar la página.</span>
            </div>
            <div><Button onClick={refetch} className="bg-greenCustom">Recargar</Button></div>
        </div>
    )
}

ErrorGetData.propTypes = {
    refetch: PropTypes.func.isRequired
}
