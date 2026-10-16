import { loadConfig } from "./config.js";
import { openDb } from "./db/index.js";
import { resetPassword, passwordBanner, DEFAULT_USERNAME } from "./auth/bootstrap.js";
import { APP_VERSION } from "./version.js";

const USAGE = `Deliverator ${APP_VERSION}

Usage:
  deliverator reset-password [username]   Set a new random password and print it (default user: ${DEFAULT_USERNAME})
  deliverator help                        Show this help

Environment: DATA_DIR points at the folder holding deliverator.db (default ./data).
`;

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "reset-password": {
    const config = loadConfig();
    const db = openDb(config.dbPath);
    const result = resetPassword(db, args[0] || DEFAULT_USERNAME);
    console.log(passwordBanner(result.username, result.password, true));
    break;
  }
  case undefined:
  case "help":
  case "--help":
  case "-h":
    console.log(USAGE);
    break;
  default:
    console.error(`Unknown command "${cmd}"\n`);
    console.log(USAGE);
    process.exit(1);
}
