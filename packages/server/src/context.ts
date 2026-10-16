import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import type { UserRow } from "./db/schema.js";
import type { Logger } from "./log.js";

/** Everything route handlers need, created once at startup. */
export interface AppContext {
  config: Config;
  db: Db;
  log: Logger;
  version: string;
}

export type AppEnv = {
  Variables: {
    ctx: AppContext;
    user: UserRow;
    sessionToken: string;
  };
};
