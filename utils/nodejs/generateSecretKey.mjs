import crypto from 'crypto';

const secretKey = crypto.randomBytes(32).toString('base64');
const iv = crypto.randomBytes(16).toString('base64');

// SONAR-EXC: NODEJS No expone logs porque es server-side
console.log('SECRET_KEY=', secretKey);
console.log('SECRET_IV=', iv);
