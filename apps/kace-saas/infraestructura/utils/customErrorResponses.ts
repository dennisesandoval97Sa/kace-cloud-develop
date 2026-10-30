/**
 * NO-SONAR: Are not included by default
 * 400: Bad Request
 * 403: Forbidden
 * 404: Not Found
 * 405: Method Not Allowed
 * 414: Request-URI Too Long
 * 416: Range Not Satisfiable
 * 500: Internal Server Error
 * 501: Not Implemented
 * 502: Bad Gateway
 * 503: Service Unavailable
 * 504: Gateway Timeout
 */
export default [
    {
        httpStatus: 400,
        responseHttpStatus: 200,
        responsePagePath: "/index.html"
    },
    {
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: "/index.html"
    },
    {
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: "/index.html"
    }
]
