import { verifyAuthToken } from "../lib/tokens.js";
import { buildUserAccessProfileById } from "../lib/auth-profile.js";

export async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const payload = verifyAuthToken(token);
    const user = await buildUserAccessProfileById(payload.sub);

    if (!user) {
      const error = new Error("Session is no longer valid");
      error.statusCode = 401;
      throw error;
    }

    req.auth = {
      token,
      payload,
      user
    };

    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
    }
    next(error);
  }
}

export async function attachOptionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      next();
      return;
    }

    const payload = verifyAuthToken(token);
    const user = await buildUserAccessProfileById(payload.sub);

    if (!user) {
      next();
      return;
    }

    req.auth = {
      token,
      payload,
      user
    };

    next();
  } catch {
    next();
  }
}
