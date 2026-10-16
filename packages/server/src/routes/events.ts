import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { StateSnapshot } from "@deliverator/shared";
import type { AppEnv } from "../context.js";
import { requireAuth } from "../auth/middleware.js";

/** Live state over Server-Sent Events: the full snapshot after every poll, plus heartbeats. */
export const eventRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", (c) => {
    const { providers } = c.get("ctx");
    return streamSSE(c, async (stream) => {
      let seq = 0;
      const send = (snap: StateSnapshot) => stream.writeSSE({ event: "state", data: JSON.stringify(snap), id: String(++seq) });
      await send(providers.getSnapshot());
      const onState = (snap: StateSnapshot) => void send(snap).catch(() => undefined);
      providers.on("state", onState);
      const heartbeat = setInterval(() => void stream.writeSSE({ event: "ping", data: "" }).catch(() => undefined), 15_000);
      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
      clearInterval(heartbeat);
      providers.off("state", onState);
    });
  });
