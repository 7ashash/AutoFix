import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role
    },
    env.auth.jwtSecret,
    {
      expiresIn: env.auth.jwtExpiresIn
    }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.auth.jwtSecret);
}
