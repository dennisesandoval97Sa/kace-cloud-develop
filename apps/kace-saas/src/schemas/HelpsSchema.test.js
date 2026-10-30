import { describe, expect, it } from "vitest";
import { HelpsSchemaForm } from "./HelpsSchema";

const validHelp = {
    titulo: "Help title",
    descripcion: "<p>Help description</p>",
    color: "#2563EB",
    is_active: 1,
};

describe("HelpsSchemaForm description", () => {
    it.each(['<p class="mb-1"><br></p>', "<p>&nbsp;</p>", "<p>&#160;</p>", "<p>&#xA0;</p>", "<p>\u200B</p>"])(
        "rejects editor markup that has no visible description content: %s",
        (descripcion) => {
            const { error } = HelpsSchemaForm.validate({ ...validHelp, descripcion });

            expect(error?.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: ["descripcion"],
                        type: "any.required",
                    }),
                ]),
            );
        },
    );

    it("accepts a description with visible rich-text content", () => {
        expect(HelpsSchemaForm.validate(validHelp).error).toBeUndefined();
    });

    it("accepts an image-only rich-text description", () => {
        const { error } = HelpsSchemaForm.validate({
            ...validHelp,
            descripcion: '<p><img src="data:image/png;base64,abc" alt="Diagram"></p>',
        });

        expect(error).toBeUndefined();
    });
});
