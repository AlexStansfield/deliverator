import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { logger, setLogLevel } from "./log.js";
import { openDb } from "./db/index.js";
import { ensureAdminUser, passwordBanner } from "./auth/bootstrap.js";
import { purgeExpiredSessions } from "./auth/session.js";
import { createApp } from "./app.js";
import { APP_VERSION } from "./version.js";
import type { AppContext } from "./context.js";
import { ProviderManager } from "./providers/manager.js";

const config = loadConfig();
setLogLevel(config.logLevel);
const log = logger("server");

if (config.allowSelfSignedCerts) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  log.warn("ALLOW_SELF_SIGNED_CERTS is on: HTTPS certificates of providers are not verified");
}

const db = openDb(config.dbPath);
const created = ensureAdminUser(db);
if (created) console.log(passwordBanner(created.username, created.password));
purgeExpiredSessions(db);

const providers = new ProviderManager(db, logger("providers"), { pollIntervalMs: config.pollIntervalMs, secretKey: config.secretKey });
providers.start();
const ctx: AppContext = { config, db, log, version: APP_VERSION, providers };
const app = createApp(ctx);

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  const url = `http://${info.address === "0.0.0.0" || info.address === "::" ? "localhost" : info.address}:${info.port}${config.basePath}/`;
  log.info(`Deliverator ${APP_VERSION} listening on ${url}`);
  if (!config.clientDir) log.warn("Web client not found; only the API is being served");
});

const sessionSweep = setInterval(() => purgeExpiredSessions(db), 6 * 60 * 60 * 1000);

function shutdown(signal: string) {
  log.info(`${signal} received, shutting down`);
  clearInterval(sessionSweep);
  providers.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
