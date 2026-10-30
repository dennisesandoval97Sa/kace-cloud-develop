import { Label } from "@kace/ui-shared"
import { LogoIcon } from "../ui-shared/src/icons"

export const PageLoadingConfiguration = () => {
    return (
        <div className="h-screen flex flex-col gap-4 items-center justify-center w-full">
            <LogoIcon height={150} width={150} />
            <Label>Cargando configuración..., por favor espere</Label>
        </div>
    )
}
