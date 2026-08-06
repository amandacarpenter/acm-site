import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, readdir, copyFile } from "fs/promises";
import { generateSitemap } from "./generate-sitemap";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "docx",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("generating sitemap...");
  await generateSitemap();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // The flyer pipeline shells out to standalone Python scripts at runtime
  // (server/pdf_pipelines/*.py) -- esbuild only bundles JS/TS, so these need
  // to be copied into dist alongside index.cjs. handleFlyerFix resolves them
  // via __dirname + "pdf_pipelines", which after bundling is dist/, so the
  // copy destination must match exactly.
  console.log("copying pdf_pipelines scripts...");
  await mkdir("dist/pdf_pipelines", { recursive: true });
  const pipelineFiles = (await readdir("server/pdf_pipelines")).filter((f) => f.endsWith(".py"));
  for (const file of pipelineFiles) {
    await copyFile(`server/pdf_pipelines/${file}`, `dist/pdf_pipelines/${file}`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
