import { PropTypes } from "prop-types"
import { NavLink } from "react-router-dom"
import AccordionSubMenu from "./accordion-sub-menu"
import ItemLink from "./item-link"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@kace/ui-shared"
import { formatTestId } from "@/utils/src/helpers"

const NavLinks = ({ route, open, setOpen, isActive }) => {

    return (
        <li
            className={`transition ease-in-out duration-150 flex items-center ${open ? "justify-start" : "justify-center"} hover:bg-slate-300 dark:hover:bg-slate-800 rounded-md min-h-10 ${isActive && "text-primary font-bold"}`}
        >
            {route.items ? (
                <AccordionSubMenu route={route} open={open} setOpen={setOpen} />
            ) : (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <NavLink
                                to={route.to}
                                className="w-full py-2 px-4 rounded-md flex"
                                onClick={() => setOpen(false)}
                                id={formatTestId("nav_link", `${route.to}`, { clean: true })}
                                data-testid={formatTestId("nav_link", `${route.to}`, { clean: true })}
                            >
                                <ItemLink
                                    name={route.name}
                                    icon={route.icon}
                                    open={open}
                                    id={formatTestId("nav_link_item", `${route.name}`, { clean: true })}
                                    data-testid={formatTestId("nav_link_item", `${route.name}`, { clean: true })}
                                />
                            </NavLink>
                        </TooltipTrigger>
                        {!open && (
                            <TooltipContent
                                id={formatTestId("nav_link_tooltip", `${route.name}`, { clean: true })}
                                data-testid={formatTestId("nav_link_tooltip", `${route.name}`, { clean: true })}
                            >
                                {route.name}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            )}
        </li>
    );
}

NavLinks.propTypes = {
    route: PropTypes.shape({
        items: PropTypes.array,
        to: PropTypes.string,
        name: PropTypes.string,
        icon: PropTypes.element
    }),
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    isActive: PropTypes.bool
}

export default NavLinks
