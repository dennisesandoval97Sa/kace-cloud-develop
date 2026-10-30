/* eslint-disable react/prop-types, react/display-name -- Los mocks son componentes desechables del test. */
import { forwardRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MultiSelect from "./index";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("react-intersection-observer", () => ({ useInView: () => ({ ref: vi.fn(), inView: false }) }));
vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Command: ({ children }) => <div>{children}</div>,
    CommandEmpty: ({ children }) => <div>{children}</div>,
    CommandGroup: ({ children }) => <div>{children}</div>,
    CommandInput: ({ onValueChange, ...props }) => (
        <input onChange={(event) => onValueChange(event.target.value)} {...props} />
    ),
    CommandItem: forwardRef(({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
            {children}
        </div>
    )),
    CommandList: ({ children }) => <div>{children}</div>,
    GeneralLoader: () => null,
    LoaderThreeDots: () => null,
    Popover: ({ children }) => <div>{children}</div>,
    PopoverContent: ({ children }) => <div>{children}</div>,
    PopoverTrigger: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/components/ui-shared/src/components/multiSelect/ListPopover", () => ({ ListPopover: () => null }));

const option = { id: "1", label: "Ana", value: "1" };

describe("MultiSelect deselect all", () => {
    it("solo lo muestra cuando el consumidor lo habilita y hay seleccion", async () => {
        const user = userEvent.setup();
        const onDeselectAll = vi.fn();
        const onInputChange = vi.fn();
        render(
            <MultiSelect
                options={[option]}
                selectedData={[option]}
                showDeselectAll
                onDeselectAll={onDeselectAll}
                onInputChange={onInputChange}
            />,
        );

        await user.click(screen.getByTestId("multiselect_btn_deselect_all"));

        expect(onDeselectAll).toHaveBeenCalledOnce();
        expect(onInputChange).toHaveBeenLastCalledWith("");
    });
});
