import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const Textarea = ({ className, name, ...props }) => {
    return (
        <textarea
            name={name}
            className={cn(
                "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            autoComplete="off"
            {...props}
        />
    );
};

Textarea.propTypes = {
    className: PropTypes.string,
    name: PropTypes.string,
};

export default Textarea;
