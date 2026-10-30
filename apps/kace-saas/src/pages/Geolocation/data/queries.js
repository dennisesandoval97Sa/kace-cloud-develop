export const filter = (idUser) => {
    return [
        {
            field: "user_id",
            operator: "eq",
            value: idUser,
            type: "AND",
        },
    ];
};

export const filterUserByGroup = (idGroup) => {
    return {
        filter: [
            {
                field: "rel_usuarios_grupos.grupo_id",
                operator: "eq",
                value: idGroup,
                type: "AND",
            },
        ],
        relationship: [
            {
                table: "rel_usuarios_grupos",
                condition: {
                    column: "rel_usuarios_grupos.usuario_id",
                    refColumn: "usuarios.id",
                },
                type: "join",
            },
        ],
    };
};
