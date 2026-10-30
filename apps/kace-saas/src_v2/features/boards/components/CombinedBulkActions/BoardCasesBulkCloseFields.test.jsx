import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardCasesBulkCloseFields } from "./BoardCasesBulkCloseFields";
import { CLOSE_REASON_MAX_LENGTH } from "@/constants/closeReason";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const renderFields = ({ close_reason = "", setFieldValue = () => {} } = {}) =>
    render(<BoardCasesBulkCloseFields errors={{}} values={{ close_reason }} setFieldValue={setFieldValue} />);

describe("BoardCasesBulkCloseFields character counter", () => {
    it("shows 0 / 5000 when the reason is empty and caps the textarea", () => {
        renderFields();

        expect(screen.getByTestId("board_close_reason_counter")).toHaveTextContent(`0 / ${CLOSE_REASON_MAX_LENGTH}`);
        expect(screen.getByTestId("board_close_reason_input")).toHaveAttribute(
            "maxLength",
            String(CLOSE_REASON_MAX_LENGTH),
        );
    });

    it("shows the current length from values.close_reason", () => {
        renderFields({ close_reason: "abc" });

        expect(screen.getByTestId("board_close_reason_counter")).toHaveTextContent(`3 / ${CLOSE_REASON_MAX_LENGTH}`);
    });
});
