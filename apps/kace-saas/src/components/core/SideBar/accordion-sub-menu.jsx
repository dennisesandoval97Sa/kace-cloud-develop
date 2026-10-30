import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@kace/ui-shared";
import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import ItemLink from "./item-link";
import { useEffect, useState } from "react";
import { formatTestId } from "@/utils/src/helpers";

const AccordionSubMenu = ({ route, setOpen, open }) => {
    const [accordionValue, setAccordionValue] = useState("");

    useEffect(() => {
        if (!open) {
            setAccordionValue("");
        }
    }, [open]);

    return (
        <Accordion
            type="single"
            collapsible
            className="w-full rounded-md flex"
            value={accordionValue}
            onValueChange={setAccordionValue}
        >
            <AccordionItem value={route.name} className="w-full rounded-md py-2 px-4 border-0">
                <AccordionTrigger
                    className="p-0 flex justify-between items-center"
                    onClick={() => {
                        setOpen(true);
                        setAccordionValue((prev) => (prev === route.name ? "" : route.name));
                    }}
                    id={formatTestId("accordion_menu", `${route.name}`)}
                    data-testid={formatTestId("accordion_menu", `${route.name}`)}
                >
                    <div className="flex justify-center items-center">
                        <span className="w-5">{route.icon}</span>{" "}
                        <span className={`transition-all duration-200 delay-200 ${open ? "block" : "hidden"} ml-2`}>
                            {route.name}
                        </span>
                    </div>
                </AccordionTrigger>

                <AccordionContent className="pb-0 pt-0">
                    <div className="mt-2">
                        {route.items.map(({ to, icon, name }) => {
                            const identifier = `submenu_item_${name.toLowerCase().replace(/\s+/g, "_")}`;
                            return (
                                <NavLink
                                    key={to}
                                    to={to}
                                    className="w-full py-2 px-4 rounded-md flex hover:bg-slate-200 dark:hover:bg-backgroundMenu"
                                    onClick={() => {
                                        setOpen(false);
                                        setAccordionValue("");
                                    }}
                                    id={identifier}
                                    data-testid={identifier}
                                >
                                    <ItemLink name={name} icon={icon} open={open} />
                                </NavLink>
                            );
                        })}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

AccordionSubMenu.propTypes = {
    route: PropTypes.shape({
        items: PropTypes.array,
        to: PropTypes.string,
        name: PropTypes.string,
        icon: PropTypes.element,
    }),
    open: PropTypes.bool,
    setOpen: PropTypes.func,
};

export default AccordionSubMenu;
