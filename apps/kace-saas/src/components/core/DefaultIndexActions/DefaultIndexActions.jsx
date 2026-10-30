import { PropTypes } from "prop-types";
import { Link } from "react-router-dom";
import { Button } from "@kace/ui-shared";
import { PlusIcon } from "lucide-react";

const DefaultIndexActions = ({
    createUrl = "",
    buttonModal = <></>,
    nameDataTestId = "create",
    children,
}) => {
    return (
        <div className="flex gap-2 justify-end absolute top-0 right-0" data-testid={nameDataTestId}>
            {createUrl ? (
                <Link to={createUrl}>
                    <Button
                        type="button"
                        size="icon"
                        title="new"
                        id={`btn_model_${nameDataTestId}`}
                        data-testid={`btn_model_${nameDataTestId}`}
                    >
                        <PlusIcon className="w-5 h-5" />
                    </Button>
                </Link>
            ) : (
                buttonModal
            )}
            {children}
        </div>
    );
};

DefaultIndexActions.propTypes = {
    createUrl: PropTypes.string,
    buttonModal: PropTypes.node,
    buttons: PropTypes.arrayOf(PropTypes.node),
    nameDataTestId: PropTypes.string,
    children: PropTypes.node,
};

export default DefaultIndexActions;
