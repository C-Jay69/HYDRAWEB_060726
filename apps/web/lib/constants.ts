export const TOKEN_COOKIE = 'hydraweb_token';

export const API_URL = process.env.API_URL || 'http://localhost:8000';

export const JWT_SECRET =
  process.env.SECRET_KEY || 'dev-secret-change-me-in-production-please';
