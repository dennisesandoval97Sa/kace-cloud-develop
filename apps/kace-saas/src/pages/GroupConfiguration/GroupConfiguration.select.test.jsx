/* eslint-disable react/prop-types */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupConfiguration from "./GroupConfiguration";

const selectPropsSpy = vi.fn();
const formikPropsSpy = vi.fn();

vi.mock("formik", async (importOriginal) => {
    const actual = await importOriginal();
    const ActualFormik = actual.Formik;

    return {
        ...actual,
        Formik: (props) => {
            formikPropsSpy(props);
            return <ActualFormik {...props} />;
        },
    };
});

vi.mock("@/components/ui-shared/src/components/Select/Select", () => ({
    Select: (props) => {
        selectPropsSpy(props);
        return <div data-testid="mocked-formik-select" data-name={props.name} />;
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: [], isLoading: false }),
    useQueries: () => [],
    useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

vi.mock("../../cognito-auth/AuthContext", () => ({
    useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../../utils/main", () => ({
    GENERAL_SETUP_SERVICE: "/general-setup",
    TYPE_APPLICATION: { AGENT: "agent", ADMIN: "admin" },
    apiService: { post: vi.fn() },
    joiFormikAdapter: () => undefined,
}));

vi.mock("../../utils/URL", () => ({
    GROUP_SERVICE: "/groups",
    USER_SERVICE: "/users",
}));

vi.mock("../../services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("../../utils/groupSyncChannel", () => ({
    broadcastGroupChanged: vi.fn(),
}));

vi.mock("../../components/core/LoaderPage/LoginLoaderPage", () => ({
    default: () => <div>loading</div>,
}));

vi.mock("../../components/core/ErrorPage/GeneralErrorPage", () => ({
    GeneralErrorPage: () => <div>error</div>,
}));

vi.mock("@kace/ui-shared", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Button: ({ children, ...props }) => <button {...props}>{children}</button>,
        Card: ({ children, ...props }) => <div {...props}>{children}</div>,
        CardHeader: ({ children }) => <div>{children}</div>,
        CardTitle: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        CardDescription: ({ children, ...props }) => <p {...props}>{children}</p>,
        CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
        CardFooter: ({ children, ...props }) => <div {...props}>{children}</div>,
    };
});

describe("GroupConfiguration select wiring", () => {
    beforeEach(() => {
        selectPropsSpy.mockClear();
        formikPropsSpy.mockClear();
        localStorage.removeItem("userGroupId");
    });

    it("passes alphabetically sorted options to Formik Select with search enabled", () => {
        const userInformation = {
            user: {},
            groups: [
                { id: "2", nombre: "Zebra" },
                { id: "1", nombre: "Alpha" },
            ],
        };

        render(<GroupConfiguration userInformation={userInformation} />);

        expect(screen.getByTestId("mocked-formik-select")).toBeTruthy();
        expect(selectPropsSpy).toHaveBeenCalled();
        const props = selectPropsSpy.mock.calls.at(-1)[0];
        expect(props.name).toBe("idGroup");
        expect(props.label).toBe("channelHub.groupConfiguration.label");
        expect(props.placeholder).toBe("channelHub.groupConfiguration.placeholder");
        expect(typeof props.onSearchChange).toBe("function");
        expect(props.options).toEqual([
            { value: "1", label: "Alpha" },
            { value: "2", label: "Zebra" },
        ]);
        expect(formikPropsSpy.mock.calls.at(-1)[0].initialValues).toEqual({ idGroup: "" });
        expect(screen.getByTestId("btn_group_configuration_submit")).toBeDisabled();
    });

    it("filters options when onSearchChange emits a term", () => {
        const userInformation = {
            user: {},
            groups: [
                { id: "2", nombre: "Zebra" },
                { id: "1", nombre: "Alpha" },
            ],
        };

        render(<GroupConfiguration userInformation={userInformation} />);
        const props = selectPropsSpy.mock.calls.at(-1)[0];
        act(() => {
            props.onSearchChange("zeb");
        });

        const latest = selectPropsSpy.mock.calls.at(-1)[0];
        expect(latest.options).toEqual([{ value: "2", label: "Zebra" }]);
    });
});
