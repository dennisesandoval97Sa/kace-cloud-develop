export const MODULES = {
    BOARDS: {
        ID: "boards",
        ROUTES: {
            ROOT: "/boards",
            CREATE: "/boards/create",
            UPDATE: "/boards/update",
        },
        PERMISSIONS: {
            READ: "BoardsRead",
            CREATE: "BoardsCreate",
            UPDATE: "BoardsUpdate",
            DELETE: "BoardsDelete",
            EXPORT: "BoardsExport",
            READ_REGISTER: "BoardsReadRegister",
            CREATE_REGISTER: "BoardsCreateRegister",
            UPDATE_REGISTER: "BoardsUpdateRegister",
        },
    },
};
