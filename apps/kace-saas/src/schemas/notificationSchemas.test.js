import { describe, expect, it } from "vitest";
import { ClientNotificationFormSchema } from "./NotificationSchema";
import { UserNotificationCreateSchema } from "./UserNotificationsSchema";

const startDate = "2026-07-15T00:00:00.000Z";
const endDate = "2026-07-20T23:59:59.999Z";
const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("notification update date validation", () => {
    it("keeps an existing client notification date range valid when the subject changes", () => {
        const { error } = ClientNotificationFormSchema.validate(
            {
                client_id: uuid,
                subject: "Updated subject",
                message: "Existing message",
                start_date: startDate,
                end_date: endDate,
                is_active: true,
            },
            { abortEarly: false },
        );

        expect(error?.details.filter(({ path }) => ["start_date", "end_date"].includes(path[0]))).toBeUndefined();
    });

    it("keeps an existing agent notification date range valid when the subject changes", () => {
        const { error } = UserNotificationCreateSchema.validate(
            {
                asunto: "Updated subject",
                mensaje: "Existing message",
                fecha_inicio: startDate,
                fecha_fin: endDate,
                leida: false,
                user_id: uuid,
                is_active: true,
            },
            { abortEarly: false },
        );

        expect(error?.details.filter(({ path }) => ["fecha_inicio", "fecha_fin"].includes(path[0]))).toBeUndefined();
    });
});
