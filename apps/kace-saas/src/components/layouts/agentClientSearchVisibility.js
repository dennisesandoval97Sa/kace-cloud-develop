/**
 * Agent header SearchClient is visible unless the tenant explicitly turns it off.
 *
 * A missing `configAgent` means the agent config is not fetched yet (hide, avoid flash).
 * Tenants saved before this setting existed have no `show_client_data` key and stay visible.
 * Header `search_clients` does not participate.
 */
export const isAgentClientSearchVisible = (configAgent) =>
    Boolean(configAgent) && (configAgent?.agent?.show_client_data ?? configAgent?.show_client_data) !== false;
