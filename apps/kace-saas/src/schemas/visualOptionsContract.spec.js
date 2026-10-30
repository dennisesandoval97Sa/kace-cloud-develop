import { COLORS } from "@kace/utils";
import { ICONS_SELECT } from "@/components/ui-shared/src/icons";
import { INITIAL_VALUES_ANS } from "@/pages/Ans/data/constants";
import { COLORS_BANNER } from "@/pages/Banners/data/constants";
import { formatDataBeforePost as formatBannerDataBeforePost } from "@/pages/Banners/helpers";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { AnsCreateSchemaForm } from "@/schemas/AnsSchema";
import { BannerCreateSchemaForm } from "@/schemas/BannersSchema";
import { HelpsSchemaForm } from "@/schemas/HelpsSchema";
import { StateSchemaForm } from "@/schemas/StateSchema";
import { validateBoardsDetails } from "@kace_v2/features/boards/schemas/boards.schema";
import {
    DEFAULT_ANS_VISUAL_COLORS,
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";

describe("visual options frontend contract", () => {
    it("keeps frontend selectors aligned with the backend-owned allowlists", () => {
        expect(COLORS).toEqual(SHARED_VISUAL_COLOR_ALLOWLIST);
        expect(COLORS_BANNER).toEqual(SHARED_VISUAL_COLOR_ALLOWLIST);
        expect(ICONS_SELECT.map((icon) => icon.name)).toEqual(SHARED_VISUAL_ICON_ALLOWLIST);
    });

    it("accepts allowlisted state values and rejects manipulated ones", () => {
        const valid = StateSchemaForm.validate({
            nombre: "Estado",
            descripcion: "Descripcion valida",
            icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
            status: 1,
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            require_observation: false,
        });
        const invalid = StateSchemaForm.validate({
            nombre: "Estado",
            descripcion: "Descripcion valida",
            icon_class: "check",
            status: 1,
            color: "#FFFFFF",
            require_observation: false,
        });

        expect(valid.error).toBeUndefined();
        expect(invalid.error).toBeDefined();
    });

    it("rejects manipulated help, banner, board, and ANS visual values", () => {
        expect(
            HelpsSchemaForm.validate({
                titulo: "Titulo",
                descripcion: "Descripcion suficientemente larga",
                color: "#FFFFFF",
                is_active: true,
            }).error,
        ).toBeDefined();

        expect(
            BannerCreateSchemaForm.validate({
                id: "11111111-1111-4111-8111-111111111111",
                descripcion: "Banner permitido",
                propiedades: {
                    position: "top-center",
                    icon: "check",
                    color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
                    siteToShow: "admin",
                },
                especificaciones: {
                    users: null,
                    groups: ["11111111-1111-4111-8111-111111111111"],
                    clients: null,
                },
                fecha_inicio: "2026-01-01",
                fecha_fin: "2026-01-02",
                status: 1,
            }).error,
        ).toBeDefined();

        expect(
            validateBoardsDetails.validate({
                name: "Board valid",
                description: "Board description",
                primary_entity: "cases",
                page_size: 25,
                onescript_form_id: "11111111-1111-4111-8111-111111111111",
                filter_onescript_id: "",
                is_active: true,
                can_view_record: true,
                can_create_record: true,
                can_edit_record: true,
                can_admin_bulk_actions: false,
                can_agent_bulk_actions: false,
                can_admin_delete_record: false,
                can_agent_delete_record: false,
                icon_class: "check",
                access_groups: [],
                access_users: [],
                criteria: { items: [{}] },
                relations: [],
                columns: [{}],
                options: [],
                orders: [],
                havings: [],
            }).error,
        ).toBeDefined();

        expect(
            AnsCreateSchemaForm.validate({
                nombre: "Ans",
                intermedio: 5,
                vencido: 10,
                color_ans_inicial: "#FFFFFF",
                color_ans_intermedio: SHARED_VISUAL_COLOR_ALLOWLIST[0],
                color_ans_final: SHARED_VISUAL_COLOR_ALLOWLIST[1],
                medicion_ans_id: "Days",
                status: 1,
            }).error,
        ).toBeDefined();
    });

    it("preserves allowlisted visual values when shaping frontend requests", () => {
        const stateRequest = genericHandleSendInformation({
            values: {
                id: "11111111-1111-4111-8111-111111111111",
                nombre: "Estado",
                descripcion: "Descripcion valida",
                icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
                color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
                require_observation: false,
                status: 1,
                created_at: "2026-01-01T00:00:00.000Z",
            },
            urlService: "/states",
            pending: false,
        });

        const bannerRequest = formatBannerDataBeforePost(
            {
                id: "11111111-1111-4111-8111-111111111111",
                descripcion: "Banner permitido",
                propiedades: {
                    color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
                    icon: SHARED_VISUAL_ICON_ALLOWLIST[0],
                    position: "top-center",
                    siteToShow: "admin",
                },
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
                created_by: "11111111-1111-4111-8111-111111111111",
                updated_by: "11111111-1111-4111-8111-111111111111",
            },
            "11111111-1111-4111-8111-111111111111",
        );

        expect(stateRequest.url).toBe("/states/11111111-1111-4111-8111-111111111111");
        expect(stateRequest.dataPost).toMatchObject({
            icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
        });
        expect(stateRequest.dataPost).not.toHaveProperty("id");

        expect(bannerRequest.propiedades).toMatchObject({
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            icon: SHARED_VISUAL_ICON_ALLOWLIST[0],
        });
        expect(bannerRequest).not.toHaveProperty("created_at");
        expect(bannerRequest).not.toHaveProperty("updated_at");
    });

    it("keeps ANS defaults and request shaping aligned with the backend contract", () => {
        expect(INITIAL_VALUES_ANS).toMatchObject({
            color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
            color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
            color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
        });

        const ansRequest = genericHandleSendInformation({
            values: {
                id: "11111111-1111-4111-8111-111111111111",
                nombre: "Ans",
                intermedio: 5,
                vencido: 10,
                color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
                color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
                color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
                medicion_ans_id: "Days",
                status: 1,
                created_at: "2026-01-01T00:00:00.000Z",
            },
            urlService: "/ans",
            pending: false,
        });

        expect(ansRequest.url).toBe("/ans/11111111-1111-4111-8111-111111111111");
        expect(ansRequest.dataPost).toMatchObject({
            color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
            color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
            color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
        });
        expect(ansRequest.dataPost).not.toHaveProperty("id");
    });
});
