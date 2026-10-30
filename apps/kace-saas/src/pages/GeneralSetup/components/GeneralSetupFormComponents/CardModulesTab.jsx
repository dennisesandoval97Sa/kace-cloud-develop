import { formatTestId } from "@/utils/src/helpers"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@kace/ui-shared"
import PropTypes from "prop-types"

export const CardModulesTab = ({
    title = "",
    description = "",
    children = <></>,
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle
                    id={formatTestId("card_modules_title", `${title}`)}
                    data-testid={formatTestId("card_modules_title", `${title}`)}
                >
                    {title}
                </CardTitle>
                <CardDescription
                    id={formatTestId("card_modules_description", `${description}`)}
                    data-testid={formatTestId("card_modules_description", `${description}`)}
                >
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">{children}</CardContent>
        </Card>
    );
}

CardModulesTab.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    children: PropTypes.node,
}
