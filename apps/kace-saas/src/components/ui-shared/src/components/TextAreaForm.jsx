import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { PropTypes } from "prop-types";

export const TextAreaForm = ({
    label = "",
    field = {},
    meta = {},
    className = "",
    touchedValue = false,
    textDescription = "",
    forceShowError = false,
    errorLayout = "inline",
    id = "textarea_form_message",
    ...props
}) => {
    const showError = Boolean(meta.error && (meta.touched || forceShowError));

    return (
        <div className="grid w-full gap-1.5">
            <div className={errorLayout === "stacked" ? "flex flex-col gap-1" : "flex justify-between"}>
                <Label
                    htmlFor={id}
                    id={`${id}_label`}
                    data-testid={`${id}_label`}
                    className={`${showError && "text-redCustom font-semibold"}`}
                >
                    {label}
                </Label>
                {showError && (
                    <Label
                        role="alert"
                        className="text-redCustom font-semibold"
                        id={`${id}_error`}
                        data-testid={`${id}_error`}
                    >
                        {meta.error}
                    </Label>
                )}
            </div>
            <Textarea
                placeholder="Type your message here."
                id={id}
                aria-invalid={showError || undefined}
                aria-describedby={showError ? `${id}_error` : undefined}
                {...field}
                {...props}
                className="max-h-[150px]"
                data-testid={`${id}_input`}
            />
            <div
                className="flex justify-between gap-1"
                id={`${id}_description_container`}
                data-testid={`${id}_description_container`}
            >
                <p className="text-sm text-muted-foreground" id={`${id}_description`} data-testid={`${id}_description`}>
                    {textDescription}
                </p>
            </div>
        </div>
    );
};

TextAreaForm.propTypes = {
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    id: PropTypes.string,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    touchedValue: PropTypes.bool,
    textDescription: PropTypes.string,
    forceShowError: PropTypes.bool,
    errorLayout: PropTypes.oneOf(["stacked", "inline"]),
};
