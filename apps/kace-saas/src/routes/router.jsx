import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "../components/layouts/MainLayout";
import AccessMiddleware from "../components/layouts/AccessMiddleware";
import NotFound from "../pages/NotFound/NotFound";
import AuthValidation from "../pages/AuthValidation/AuthValidation";
import Logout from "../pages/Logout/Logout";
import { ROUTES } from "@/config/routesDictionary";
import { AccessControlPage } from "@/components/core/AccessControl/AccessControlPage";

const children = Object.entries(ROUTES).map(([_, route]) => {
    const { path, metaData, parentKey, Component } = route;
    const loader = metaData ?? ROUTES[parentKey]?.metaData ?? {};
    return {
        path,
        element: <Component />,
        loader: () => ({
            ...loader,
        }),
    };
});

const router = createBrowserRouter([
    {
        path: "/",
        element: <Navigate to="/auth" replace />,
    },
    {
        path: "/auth",
        element: <AuthValidation />,
    },
    {
        path: "/",
        element: (
            <AccessMiddleware>
                <MainLayout />
            </AccessMiddleware>
        ),
        errorElement: <NotFound />,
        children,
    },
    {
        path: "/logout",
        element: <Logout />,
    },
    {
        path: "/access-control",
        element: <AccessControlPage />,
    },
    {
        path: "*",
        element: <NotFound />,
    },
]);

export default router;
