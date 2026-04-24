import { Router } from "express";
import { query } from "../config/database.js";
import {
  buildUserAccessProfileById,
  findUserWithPasswordByEmail,
  resolveGarageVehicleSelection
} from "../lib/auth-profile.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { signAuthToken } from "../lib/tokens.js";
import { requireAuth } from "../middleware/authenticate.js";

const router = Router();

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function requireVehicleSelection(payload = {}) {
  const brandKey = String(payload?.brandKey || "").trim().toLowerCase();
  const modelKey = String(payload?.modelKey || "").trim().toLowerCase();
  const vehicleYearId = Number(payload?.vehicleYearId || 0);

  if (!brandKey || !modelKey || !vehicleYearId) {
    throw badRequest("Vehicle brand, model, and year are required");
  }

  const savedVehicle = await resolveGarageVehicleSelection({
    brandKey,
    modelKey,
    vehicleYearId
  });

  if (!savedVehicle) {
    throw badRequest("Selected vehicle is not valid");
  }

  return savedVehicle;
}

router.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const fullName = String(req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const savedVehicle = await requireVehicleSelection(req.body);

    if (!username || !email || !password || !fullName) {
      throw badRequest("Username, full name, email, and password are required");
    }

    if (password.length < 6) {
      throw badRequest("Password must be at least 6 characters");
    }

    const existing = await query(
      `
        SELECT id
        FROM users
        WHERE email = :email OR username = :username
        LIMIT 1
      `,
      { email, username }
    );

    if (existing[0]) {
      throw badRequest("This email or username is already registered");
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `
        INSERT INTO users (
          username,
          email,
          password_hash,
          full_name,
          phone,
          garage_vehicle_year_id,
          role,
          account_status
        )
        VALUES (
          :username,
          :email,
          :passwordHash,
          :fullName,
          :phone,
          :garageVehicleYearId,
          'user',
          'active'
        )
      `,
      {
        username,
        email,
        passwordHash,
        fullName,
        phone,
        garageVehicleYearId: savedVehicle.vehicleYearId
      }
    );

    const user = await buildUserAccessProfileById(result.insertId);
    const token = signAuthToken(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.user.id;
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const fullName = String(req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const addressLine = String(req.body?.addressLine || "").trim();
    const city = String(req.body?.city || "").trim();
    const savedVehicle = await requireVehicleSelection(req.body);

    if (!username || !email || !fullName) {
      throw badRequest("Username, full name, and email are required");
    }

    const existing = await query(
      `
        SELECT id
        FROM users
        WHERE (email = :email OR username = :username)
          AND id <> :userId
        LIMIT 1
      `,
      { email, username, userId }
    );

    if (existing[0]) {
      throw badRequest("This email or username is already registered");
    }

    await query(
      `
        UPDATE users
        SET
          username = :username,
          email = :email,
          full_name = :fullName,
          phone = :phone,
          address_line = :addressLine,
          city = :city,
          garage_vehicle_year_id = :garageVehicleYearId
        WHERE id = :userId
        LIMIT 1
      `,
      {
        userId,
        username,
        email,
        fullName,
        phone,
        addressLine: addressLine || null,
        city: city || null,
        garageVehicleYearId: savedVehicle.vehicleYearId
      }
    );

    const user = await buildUserAccessProfileById(userId);

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      throw badRequest("Email and password are required");
    }

    const user = await findUserWithPasswordByEmail(email);
    if (!user) {
      const error = new Error("Incorrect email or password");
      error.statusCode = 401;
      throw error;
    }

    const matched = await verifyPassword(password, user.passwordHash);
    if (!matched) {
      const error = new Error("Incorrect email or password");
      error.statusCode = 401;
      throw error;
    }

    if (user.accountStatus === "suspended") {
      const error = new Error("This account is suspended");
      error.statusCode = 403;
      throw error;
    }

    const profile = await buildUserAccessProfileById(user.id);
    const token = signAuthToken(profile);

    res.json({
      success: true,
      data: {
        token,
        user: profile
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const freshProfile = await buildUserAccessProfileById(req.auth.user.id);
    if (!freshProfile) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      data: {
        user: freshProfile
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users/:userId", requireAuth, async (req, res, next) => {
  try {
    const profile = await buildUserAccessProfileById(req.params.userId);
    if (!profile) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

export default router;
