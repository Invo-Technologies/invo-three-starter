import { createApp } from "./app.js";

const app = await createApp();
const port = Number(process.env["PORT"]) || 3000;

app.httpServer.listen(port, "0.0.0.0", () => {
  const { setup, demo, projectId, publicUrl, webhookProblem } = app.invo;
  const lines = [`Game running at ${publicUrl ?? `http://localhost:${port}`}`];
  if (demo) {
    lines.push("INVO: public demo sandbox (test money, fictional players). Going live: add INVO_GAME_SECRET and INVO_WEBHOOK_SECRET in Secrets.");
  } else if (setup.missing.length) {
    lines.push(`INVO is not connected yet. Add ${setup.missing.join(" and ")} in Tools → Secrets, then restart.`);
  } else {
    const where = setup.environment === "production" ? "PRODUCTION (real money)" : setup.environment === "sandbox" ? "sandbox (test money)" : "checking your key";
    lines.push(`INVO: ${where}. Webhook URL for the INVO console: ${publicUrl ?? `http://localhost:${port}`}/api/invo/webhook`);
  }
  if (projectId) lines.push(`INVO project: ${projectId}`);
  if (webhookProblem) lines.push(`Checkout credits are off: ${webhookProblem}`);
  if (app.storeKind === "file" && setup.environment === "production") {
    lines.push("Warning: the ledger is a file in .data/. Add a PostgreSQL database (DATABASE_URL) so it survives redeploys.");
  }
  console.log(lines.map((l) => `  ${l}`).join("\n"));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}
