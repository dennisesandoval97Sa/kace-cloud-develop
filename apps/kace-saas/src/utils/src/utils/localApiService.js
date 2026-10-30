/**
 * Local API mappings for development.
 *
 * Configure exact URL matches here to be routed to a local URL (usually running on localhost).
 * Example:
 *   {
 *     "/v1/some/remote/route": "http://127.0.0.1:60053/some/local/route"
 *   }
 */
const LOCAL_MAPPINGS = {
};

export const hasLocal = (url) => !!LOCAL_MAPPINGS[url];

export const getLocalUrl = (url) => LOCAL_MAPPINGS[url] || url;

export default {
    LOCAL_MAPPINGS,
    hasLocal,
    getLocalUrl,
};
