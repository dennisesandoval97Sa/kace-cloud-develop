import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@kace/ui-shared";
import { ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { ACTION_MENU_GROUPS, LIST_FORMS_ACTIONS } from "../data/constants";
import { useTranslation } from "react-i18next";
import { Fragment } from "react";
import { formatTestId } from "@/utils/src/helpers";

const URL = "/actions/create";
const ASSIGNMENT_MENU_GROUPS = [
    ACTION_MENU_GROUPS.ADVISOR_ASSIGNMENT,
    ACTION_MENU_GROUPS.GROUP_ASSIGNMENT,
    ACTION_MENU_GROUPS.USER_ASSIGNMENT,
];

export const MenuOptionsToActions = () => {
    const { t } = useTranslation();
    const visibleActions = LIST_FORMS_ACTIONS.filter((item) => !item.hidden);
    const actionsInGroup = (menuGroup) => visibleActions.filter((item) => item.menuGroup === menuGroup);
    const assignmentActionGroups = ASSIGNMENT_MENU_GROUPS.map(actionsInGroup).filter((group) => group.length > 0);
    const topLevelActions = actionsInGroup(ACTION_MENU_GROUPS.TOP_LEVEL);

    return (
        <div className="flex justify-center w-full p-2 rounded-lg border bg-card text-card-foreground shadow-sm">
            <Menubar className="h-auto w-full md:w-auto flex flex-col md:flex-row">
                {assignmentActionGroups.length > 0 && (
                    <MenubarMenu>
                        <MenubarTrigger
                            className="min-w-20 flex justify-between gap-4 font-semibold"
                            id="menu_trigger_assignment_actions"
                            data-testid="menu_trigger_assignment_actions"
                        >
                            {t("actions.title.assignmentActions")} <ChevronsUpDown size={16} />
                        </MenubarTrigger>
                        <MenubarContent>
                            {assignmentActionGroups.map((group, groupIndex) => (
                                <Fragment key={group[0].valueForm}>
                                    {groupIndex > 0 && <MenubarSeparator />}
                                    {group.map((item) => (
                                        <Link key={item.valueForm} to={{ pathname: URL }} state={item}>
                                            <MenubarItem
                                                className="hover:bg-primary"
                                                id={`menu_item_${item.valueForm}`}
                                                data-testid={`menu_item_${item.valueForm}`}
                                            >
                                                {t(item.title)}
                                            </MenubarItem>
                                        </Link>
                                    ))}
                                </Fragment>
                            ))}
                        </MenubarContent>
                    </MenubarMenu>
                )}

                {topLevelActions.map((item) => {
                    const isDisabled = Boolean(item.disabled);

                    return (
                        <MenubarMenu key={item.valueForm}>
                            <MenubarTrigger
                                className={`min-w-28 font-semibold hover:bg-primary ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                                id={`menu_trigger_${item.valueForm}`}
                                data-testid={`menu_trigger_${item.valueForm}`}
                            >
                                {!isDisabled ? (
                                    <Link
                                        to={{ pathname: URL }}
                                        state={item}
                                        id={formatTestId("menu_opt_title", `${item.title}`)}
                                        data-testid={formatTestId("menu_opt_title", `${item.title}`)}
                                    >
                                        <p>{t(item.title)}</p>
                                    </Link>
                                ) : (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <p>{t(item.title)}</p>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t("actions.messages.optionNotEnabled")}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </MenubarTrigger>
                        </MenubarMenu>
                    );
                })}
            </Menubar>
        </div>
    );
};
