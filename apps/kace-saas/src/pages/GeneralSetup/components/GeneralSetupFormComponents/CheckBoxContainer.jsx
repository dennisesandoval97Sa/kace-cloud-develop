import { formatTestId } from "@/utils/src/helpers";
import { Checkbox, Label } from "@kace/ui-shared";
import PropTypes from "prop-types";

export const CheckBoxContainer = ({
    text = "",
    value = false,
    setFieldValue,
    name = "",
    "data-testid": dataTestId,
}) => {
    return (
        <div className="flex w-full items-center gap-2" data-testid={dataTestId}>
            <Checkbox
                checked={!!value}
                id={formatTestId("check_box_cont", `${name}_${value}`)}
                data-testid={dataTestId ?? formatTestId("check_box_cont", `${name}_${value}`)}
                onCheckedChange={(value) => {
                    setFieldValue(name, value);
                }}
            />
            <Label
                htmlFor="terms"
                className="text-left text-sm"
                id={formatTestId("check_box_terms", `${text}`)}
                data-testid={formatTestId("check_box_terms", `${text}`)}
            >
                {text}
            </Label>
        </div>
    );
};

CheckBoxContainer.propTypes = {
    text: PropTypes.string.isRequired,
    value: PropTypes.bool.isRequired,
    setFieldValue: PropTypes.func.isRequired,
    name: PropTypes.string.isRequired,
    "data-testid": PropTypes.string,
};
