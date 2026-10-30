import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MailAccountsForm from "./MailAccountsForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "mailAccounts.form.register_in_channel_hub": "Register in Channel Hub",
                "mailAccounts.title.register_in_channel_hub": "Register in Channel Hub",
            })[key] ?? key,
    }),
}));

vi.mock("@kace/utils", () => ({
    MAIL_ACCOUNT_TYPE_SERVICE: "/mail-account-types",
    joiFormikAdapter: () => undefined,
}));

vi.mock("../../../components/core/Cards/FormCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../components/core/Cards/InputCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../components/core/Cards/section-form", () => ({
    default: ({ children, title }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
}));

vi.mock("../../../components/core/selector-admin", () => ({
    SelectorAdmin: () => <div data-testid="selector-admin" />,
}));

vi.mock("../../../components/core/switchState/SwitchStateAdmin", () => ({
    SwitchStateAdmin: () => <div data-testid="switch-state-admin" />,
}));

vi.mock("../../../components/core/SelectByUrl/SelectByUrl", () => ({
    SelectByUrl: ({ label }) => <span>{label}</span>,
}));

vi.mock("@kace/ui-shared", () => ({
    InputForm: ({ label, name }) => (
        <label>
            {label}
            <input name={name} />
        </label>
    ),
    KField: ({ children }) => <div>{children}</div>,
    SelectForm: ({ label, name }) => (
        <label>
            {label}
            <select name={name} />
        </label>
    ),
}));

describe("MailAccountsForm", () => {
    it.each([
        ["create", { type: "smtp" }],
        ["edit", { id: "mail-account-id", type: "smtp", register_in_channel_hub: true }],
    ])("does not render Channel Hub registration in %s mode", (_mode, data) => {
        render(<MailAccountsForm dataHandler={vi.fn()} data={data} />);

        expect(screen.queryAllByText("Register in Channel Hub")).toHaveLength(0);
        expect(screen.queryByTestId("register_in_channel_hub_checkbox")).not.toBeInTheDocument();
    });
});
