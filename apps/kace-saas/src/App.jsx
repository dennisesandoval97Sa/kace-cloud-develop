import { RouterProvider } from "react-router-dom";
import router from "./routes/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import store from "./redux/store";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import GeneralSetupProvider from "./components/layouts/GeneralSetupProvider";
import { ThemeProvider } from "./components/ui-shared/src/components/theme-provider";
import { AuthProvider } from "./cognito-auth/AuthContext";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 3,
            refetchOnWindowFocus: false,
        },
    },
});

const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <ThemeProvider>
                    <AuthProvider>
                        <GeneralSetupProvider>
                            <RouterProvider router={router} />
                        </GeneralSetupProvider>
                    </AuthProvider>
                </ThemeProvider>
            </Provider>
            <ReactQueryDevtools />
        </QueryClientProvider>
    );
};

export default App;
