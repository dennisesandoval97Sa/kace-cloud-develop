import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@kace/ui-shared"
import PropTypes from "prop-types"

export const RoleFormCardModulesTab = ({
    title = "",
    description = "",
    children = <></>
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle id="role_form_card_modules_tab_title" data-testid="role_form_card_modules_tab_title">
                    {title}
                </CardTitle>
                <CardDescription
                    id="role_form_card_modules_tab_description"
                    data-testid="role_form_card_modules_tab_description"
                >
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2" id="role_form_card" data-testid="role_form_card">
                {children}
            </CardContent>
        </Card>
    );
}

RoleFormCardModulesTab.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    children: PropTypes.node
}
