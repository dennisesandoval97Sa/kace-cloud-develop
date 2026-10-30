import React from "react"
import { GeneralLoader } from "../../ui-shared"

export const LoadingCaseInformation = () => {
    return (
        <div
            className="bg-background w-full shadow-md rounded-md flex justify-center items-center"
            style={{
                height: "calc(100vh - 13rem)"
            }}
        >
            <div className="flex flex-col gap-2 items-center justify-center">
                <GeneralLoader />
                <h2 className="text-2xl font-semibold text-foreground">
                    Cargando...
                </h2>
                <p className="text-muted-foreground mt-2 text-center max-w-md">
                    Cargando la información del caso. Por favor, espere un momento...
                </p>
            </div>
        </div>
    )
}
