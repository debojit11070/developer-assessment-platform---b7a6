import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../../config/env.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export function signAccessToken(payload: object): string {
  const opts: SignOptions = { expiresIn: config.jwt.accessExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, config.jwt.accessSecret, opts);
}

export function signRefreshToken(payload: object): string {
  const opts: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, config.jwt.refreshSecret, opts);
}

export function verifyRefreshToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as jwt.JwtPayload;
}

export function issueTokens(payload: { sub: string; email: string; role: string }): TokenPair {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    accessExpiresIn: config.jwt.accessExpiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
  };
}
