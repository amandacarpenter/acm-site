// Private Computer preview only. Not imported by the production application.
import express from "express";
import path from "node:path";
import { registerLargeDocuments } from "../../server/largeDocuments";
if (process.env.NODE_ENV === "production") {
  throw new Error("This entry is private-preview only. Add production authentication before a public deployment.");
}
const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (_req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});
const manager = registerLargeDocuments(app, {
  root: process.env.LARGE_DOCS_DATA_DIR || "/tmp/remedy-large-docs-private-preview",
  pipeline: path.resolve("server/pdf_pipelines"),
  model: process.env.LARGE_DOCS_MODEL || "claude_sonnet_5_5",
  fake: process.env.LARGE_DOCS_FAKE_AI === "1",
  chunkSize: Number(process.env.LARGE_DOCS_CHUNK_SIZE || 20),
}, (_req, res, next) => { res.locals.largeDocumentOwner = "private-preview-owner"; next(); });
app.use(express.static(path.resolve("large-docs-preview-dist")));
app.get("/health", (_req, res) => res.json({ status: "ok", preview: true }));
const server = app.listen(Number(process.env.PORT || 8766), "0.0.0.0");
process.on("SIGTERM", () => { manager.close(); server.close(() => process.exit()); });
