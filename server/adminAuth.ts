import type { RequestHandler } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";

const DEFAULT_ADMIN_EMAIL = "amandathecarpenter@gmail.com";

type VerifiedSession = {
  sub: string;
};

type ClerkEmailAddress = {
  id: string;
  emailAddress: string;
};

type ClerkUser = {
  primaryEmailAddressId: string | null;
  emailAddresses: ClerkEmailAddress[];
};

type VerifyTokenOptions = {
  secretKey: string;
  authorizedParties: string[];
};

export type AdminAuthDependencies = {
  secretKey?: string;
  adminEmail?: string;
  authorizedParties?: string[];
  verifyClerkToken?: (
    token: string,
    options: VerifyTokenOptions,
  ) => Promise<VerifiedSession>;
  getUser?: (userId: string) => Promise<ClerkUser>;
};

export function getAdminAuthorizedParties(
  configured = process.env.ADMIN_AUTHORIZED_PARTIES,
  nodeEnv = process.env.NODE_ENV,
): string[] {
  if (configured?.trim()) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const productionOrigins = [
    "https://remedy508.com",
    "https://www.remedy508.com",
  ];
  if (nodeEnv === "production") return productionOrigins;

  return [
    ...productionOrigins,
    "http://localhost:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173",
  ];
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export function createAdminAuthMiddleware(
  dependencies: AdminAuthDependencies = {},
): RequestHandler {
  const secretKey = dependencies.secretKey ?? process.env.CLERK_SECRET_KEY;
  const adminEmail = (
    dependencies.adminEmail ??
    process.env.ADMIN_EMAIL ??
    DEFAULT_ADMIN_EMAIL
  ).trim().toLowerCase();
  const authorizedParties = dependencies.authorizedParties ??
    getAdminAuthorizedParties();

  const clerkClient = secretKey
    ? createClerkClient({ secretKey })
    : null;

  const verifyClerkToken = dependencies.verifyClerkToken ?? verifyToken;
  const verifySessionToken =
    (secretKey
      ? async (token: string) => {
          const payload = await verifyClerkToken(token, {
            secretKey,
            authorizedParties,
          });
          return { sub: payload.sub };
        }
      : null);

  const getUser = dependencies.getUser ??
    (clerkClient
      ? async (userId: string) => {
          const user = await clerkClient.users.getUser(userId);
          return {
            primaryEmailAddressId: user.primaryEmailAddressId,
            emailAddresses: user.emailAddresses.map((email) => ({
              id: email.id,
              emailAddress: email.emailAddress,
            })),
          };
        }
      : null);

  return async (req, res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token || !verifySessionToken || !getUser || !adminEmail) {
      return res.status(404).json({ error: "Not found" });
    }

    try {
      const session = await verifySessionToken(token);
      if (!session.sub) {
        return res.status(404).json({ error: "Not found" });
      }

      const user = await getUser(session.sub);
      const primaryEmail = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
      )?.emailAddress.toLowerCase();

      if (primaryEmail !== adminEmail) {
        return res.status(404).json({ error: "Not found" });
      }

      next();
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  };
}
