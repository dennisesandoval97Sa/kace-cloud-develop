import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const AdminCaseCardModules = ({ title = "", description = "", className = "", children = <></> }) => {
    const { t } = useTranslation();
    const showHeader = Boolean(title) || Boolean(description);
    return (
        <Card className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            {showHeader ? (
                <CardHeader className="shrink-0">
                    {title ? <CardTitle>{t(title)}</CardTitle> : null}
                    {description ? <CardDescription>{t(description)}</CardDescription> : null}
                </CardHeader>
            ) : null}
            <CardContent className={cn("p-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto", className)}>
                {children}
            </CardContent>
        </Card>
    );
};

AdminCaseCardModules.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    className: PropTypes.string,
    children: PropTypes.node,
};
