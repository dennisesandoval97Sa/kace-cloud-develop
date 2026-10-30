import NavLinks from "./NavLinks"
import PropTypes from "prop-types"
import { Button, ScrollArea } from "@kace/ui-shared"
import { useLocation } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useAccessRoutes } from "@/hooks/useAccessRoutes"

const SideBar = ({ setOpen, open }) => {
    const location = useLocation()
    const { accessRoutes } = useAccessRoutes()

    return (
        <div className="h-full flex flex-col z-10">
            <ScrollArea className="h-full flex flex-col justify-between bg-backgroundMenu">
                <nav>
                    <ul className="flex flex-col gap-2 p-1">
                        {accessRoutes.map((route) => (
                            <NavLinks
                                key={`${route.to}-${route.name}`}
                                route={route}
                                open={open}
                                setOpen={setOpen}
                                isActive={location.pathname === route.to}
                            />
                        ))}
                    </ul>
                </nav>
            </ScrollArea>
            <div className="h-10 flex justify-center items-center bg-background">
                <Button
                    onClick={() => setOpen(!open)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    id="btn_sidebar_toggle"
                    data-testid="btn_sidebar_toggle"
                >
                    {open ? <ChevronLeft /> : <ChevronRight />}
                </Button>
            </div>
        </div>
    );
}

SideBar.propTypes = {
    setOpen: PropTypes.func,
    open: PropTypes.bool
}

export default SideBar
