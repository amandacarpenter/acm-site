import assert from "node:assert/strict";
import express from "express";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  createAdminAuthMiddleware,
  getAdminAuthorizedParties,
} from "../server/adminAuth";

const ADMIN_ROUTES = [
  "/api/admin/dashboard",
  "/api/admin/cost-summary",
  "/api/admin/backup-db",
  "/api/admin/debug-last-html",
];

async function main() {
  const verifierCalls: {
    token: string;
    secretKey: string;
    authorizedParties: string[];
  }[] = [];
  const requireAdmin = createAdminAuthMiddleware({
    secretKey: "test-secret",
    adminEmail: "owner@example.com",
    authorizedParties: ["https://remedy508.com"],
    verifyClerkToken: async (token, options) => {
      verifierCalls.push({ token, ...options });
      if (token === "invalid") throw new Error("invalid token");
      if (token === "admin-token") return { sub: "admin-user" };
      if (token === "other-token") return { sub: "other-user" };
      throw new Error("unexpected token");
    },
    getUser: async (userId) => ({
      primaryEmailAddressId: "primary-email",
      emailAddresses: [{
        id: "primary-email",
        emailAddress: userId === "admin-user"
          ? "OWNER@example.com"
          : "someone-else@example.com",
      }],
    }),
  });

  const app = express();
  for (const route of ADMIN_ROUTES) {
    app.get(route, requireAdmin, (_req, res) => {
      res.json({ authorized: true, route });
    });
  }

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (const route of ADMIN_ROUTES) {
      const legacyKeyOnly = await fetch(
        `${baseUrl}${route}?key=formerly-public-key`,
      );
      assert.equal(legacyKeyOnly.status, 404, `${route} accepted the legacy key`);

      const invalidToken = await fetch(`${baseUrl}${route}`, {
        headers: { Authorization: "Bearer invalid" },
      });
      assert.equal(invalidToken.status, 404, `${route} accepted an invalid token`);

      const nonAdmin = await fetch(`${baseUrl}${route}`, {
        headers: { Authorization: "Bearer other-token" },
      });
      assert.equal(nonAdmin.status, 404, `${route} accepted a non-admin user`);

      const admin = await fetch(`${baseUrl}${route}`, {
        headers: { Authorization: "Bearer admin-token" },
      });
      assert.equal(admin.status, 200, `${route} rejected the admin user`);
      assert.deepEqual(await admin.json(), { authorized: true, route });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }

  assert(
    verifierCalls.every(
      (call) =>
        call.secretKey === "test-secret" &&
        call.authorizedParties.length === 1 &&
        call.authorizedParties[0] === "https://remedy508.com",
    ),
    "Clerk verification did not receive the authorized-party allowlist",
  );
  assert.deepEqual(
    getAdminAuthorizedParties(undefined, "production"),
    ["https://remedy508.com", "https://www.remedy508.com"],
  );

  const routeSource = await readFile(
    new URL("../server/routes.ts", import.meta.url),
    "utf8",
  );
  for (const route of ADMIN_ROUTES) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert(
      new RegExp(
        `app\\.get\\("${escapedRoute}",\\s*requireAdmin\\s*,`,
      ).test(routeSource),
      `${route} is not wired to requireAdmin in server/routes.ts`,
    );
  }
  assert(!routeSource.includes("req.query.key"));
  assert(!routeSource.includes("ADMIN_STATS_KEY"));

  console.log("Admin route authorization tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
