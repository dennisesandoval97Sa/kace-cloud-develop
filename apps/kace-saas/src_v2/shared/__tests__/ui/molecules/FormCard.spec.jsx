import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FormCard from "@kace_v2/shared/ui/molecules/FormCard";
import InputField from "@kace_v2/shared/ui/molecules/InputField";

describe("Form card", () => {
    it("should render a form card with input field", () => {
        render(
            <FormCard title="User information" description="User basic information">
                <InputField data-testid="inputField" />
            </FormCard>,
        );
        const card = screen.getByTestId("form-card-user-information");
        const title = screen.getByTestId("form-card-title-user-information");
        const subTitle = screen.getByTestId("form-card-sub-title-user-basic-information");
        const inputField = screen.getByTestId("inputField");
        expect(card).toBeInTheDocument();
        expect(title).toBeInTheDocument();
        expect(subTitle).toBeInTheDocument();
        expect(inputField).toBeInTheDocument();
    });
});
