import React from "react"
import PropTypes from "prop-types"
import { Loader2 } from "lucide-react"
import { LogoIcon } from "../icons"
import { cn } from "../lib/utils"

export const GeneralLoader = ({ className = "h-64 w-full flex justify-center items-center" }) => {
    return (
        <div className={cn("relative", className)}>
            <Loader2 className="h-36 w-36 animate-spin text-primary" />
            <div className="h-16 w-16 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <LogoIcon height={64} width={64} />
            </div>
        </div>
    )
}

GeneralLoader.propTypes = {
    className: PropTypes.string
}
