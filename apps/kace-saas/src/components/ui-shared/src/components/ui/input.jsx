import { forwardRef } from "react"
import { cn } from "../../lib/utils"
import PropTypes from "prop-types"
import { formatTestId } from "@/utils/src/helpers"

const Input = forwardRef(({ className, type, name, ...props }, ref) => {

    return (
        <input
            type={type}
            className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            autoComplete="off"
            ref={ref}
            id={formatTestId("input", `${name}`)}
            data-testid={formatTestId("input", `${name}`)}
            {...props}
        />
    )
})
Input.displayName = "Input"

Input.propTypes = {
    className: PropTypes.string,
    type: PropTypes.string,
    name: PropTypes.string,
}

export { Input }
