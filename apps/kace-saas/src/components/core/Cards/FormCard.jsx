import { Button } from "@/components/ui-shared";
import { cn } from "@/componentsV2/lib/utils";
import { handlerLogout } from "@/services/cognitoService";
import useIsSeeMode from "@/hooks/useIsSeeMode";
import { formatTestId } from "@/utils/src/helpers";
import { ChevronLeft } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const FormCard = ({
    children,
    isId = false,
    genericTitle = true,
    title = "",
    isSending = false,
    classNameDiv = "",
    classNameContainer = "",
    status,
    isTesting = false,
    showTestButton = false,
    onTest,
    lockChildrenInSeeMode = true,
}) => {
    const navigation = useNavigate();
    const { t } = useTranslation();
    const location = useLocation();
    const { id } = useParams();
    const isSeeMode = useIsSeeMode();
    const isUsersModule = location.pathname.includes("user/update");
    const lockChildren = isSeeMode && lockChildrenInSeeMode;

    return (
        <div className={cn("flex flex-col gap-8 p-4 w-full 2xl:w-4/5 h-full", classNameContainer)}>
            <div className="flex w-full h-auto items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigation(-1)}
                    type="button"
                    id="btn_back_form_card"
                    data-testid="btn_back_form_card"
                >
                    <ChevronLeft />
                </Button>
                <h2
                    className="font-bold text-2xl p-2 w-full"
                    id={formatTestId("form_card_title", `${title}`)}
                    data-testid={formatTestId("form_card_title", `${title}`)}
                >
                    {genericTitle &&
                        (isId
                            ? isSeeMode
                                ? t("app.forms.titles.see", { entity: title })
                                : t("app.forms.titles.edit", { entity: title })
                            : t("app.forms.titles.create", { entity: title }))}
                </h2>
                {isUsersModule && (
                    <Button
                        variant="destructive"
                        type="button"
                        onClick={() => handlerLogout(id)}
                        disabled={isSending || isSeeMode}
                        id="btn_form_card_force_logout"
                        data-testid="btn_form_card_force_logout"
                    >
                        {t("app.button.forceLogout", "Force logout")}
                    </Button>
                )}
                {showTestButton && isSeeMode && (
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onTest();
                        }}
                        className="ml-2"
                        id="btn_form_card_test"
                        data-testid="btn_form_card_test"
                        disabled={isTesting}
                    >
                        {isTesting ? t("restEndPoint.testing") : t("restEndPoint.testRequest")}
                    </Button>
                )}
                {genericTitle && (
                    <Button
                        type="submit"
                        disabled={isSending || isSeeMode}
                        className={`${isSending && "cursor-not-allowed opacity-40"}`}
                        id={formatTestId("btn_form_card", `${isSending ? "sending" : isId ? "update" : "save"}`)}
                        data-testid={formatTestId(
                            "btn_form_card",
                            `${isSending ? "sending" : isId ? "update" : "save"}`,
                        )}
                    >
                        {isSending ? "Enviando..." : isId ? t("button.update") : t("button.save")}
                    </Button>
                )}
            </div>
            <div className={cn("flex flex-col lg:grid grid-cols-5 gap-8 h-full", classNameDiv)}>
                {lockChildren && (
                    <div
                        className="bg-transparent absolute h-full w-full z-50"
                        data-testid="form_card_see_mode_overlay"
                    ></div>
                )}
                {typeof status === "string" && (
                    <p className="col-span-full font-semibold text-base text-orangeCustom text-center border-orangeCustom border-2 rounded-md p-2 bg-orangeCustom/30">
                        {status.replace(/^[^:]*: /, "")}
                    </p>
                )}
                <fieldset disabled={lockChildren} className="contents">
                    {children}
                </fieldset>
            </div>
        </div>
    );
};
FormCard.propTypes = {
    children: PropTypes.node,
    isId: PropTypes.bool,
    title: PropTypes.string,
    genericTitle: PropTypes.bool,
    isSending: PropTypes.bool,
    classNameDiv: PropTypes.string,
    classNameContainer: PropTypes.string,
    status: PropTypes.any,
    isTesting: PropTypes.bool,
    showTestButton: PropTypes.bool,
    onTest: PropTypes.func,
    lockChildrenInSeeMode: PropTypes.bool,
};
export default FormCard;
