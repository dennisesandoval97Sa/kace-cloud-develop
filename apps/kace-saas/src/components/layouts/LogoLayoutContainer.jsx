import React from "react"
import { LogoIcon } from "../ui-shared/src/icons"
import PropTypes from "prop-types"
import { Separator } from "../ui-shared"
import { useTranslation } from "react-i18next"

export const LogoLayoutContainer = ({ configHeader, currentGroup }) => {
    const { t } = useTranslation()
    const handleRedirect = () => {
        const path = window.location.pathname.includes("/agent") ? "/agent" : "/dashboard"
        window.location.href = path
    }

    return (
        <>
            <button
                type="button"
                onClick={handleRedirect}
                className="cursor-pointer bg-transparent border-none p-0 m-0"
                aria-label="Redirect to homepage"
                id="btn_layout_redirect_to_homepage"
                data-testid="btn_layout_redirect_to_homepage"
            >
                {configHeader.custom_logo ? (
                    <img src={configHeader.custom_logo} alt="logo" height={38} width={38} />
                ) : (
                    <LogoIcon height={38} width={38} />
                )}
            </button>
            <Separator className="h-6 bg-muted" orientation="vertical" />
            <p
                className="text-xs lg:text-sm font-semibold break-words w-full"
                id="layout_group_info"
                data-testid="layout_group_info"
            >
                {currentGroup?.nombre
                    ? `${t("gridMain.columns.group")}: ${currentGroup.nombre}`
                    : t("app.text.unknown")}
            </p>
        </>
    );
}

LogoLayoutContainer.propTypes = {
    configHeader: PropTypes.object,
    currentGroup: PropTypes.object
}
