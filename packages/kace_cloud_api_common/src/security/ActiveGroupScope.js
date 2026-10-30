export const activeGroupScopeFromAuthenticatedUser = (user) => ({
    userId: user?.id?.value ?? user?.id ?? null,
    activeGroupId: user?.grupo_activo?.value ?? user?.grupo_activo ?? null,
});
