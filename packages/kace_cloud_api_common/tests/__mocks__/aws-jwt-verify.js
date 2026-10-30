import jwt from 'jsonwebtoken';

export const CognitoJwtVerifier = {
    create: () => ({
        verify: (token) => Promise.resolve(jwt.decode(token)),
    }),
};
