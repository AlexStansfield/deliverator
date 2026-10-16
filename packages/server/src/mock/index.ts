import { serve } from "@hono/node-server";
import { createQbMock } from "./qbittorrent-mock.js";
import { createSabMock } from "./sabnzbd-mock.js";

/**
 * `pnpm mock` – runs fake qBittorrent and SABnzbd servers with slowly progressing downloads.
 * Add them in Deliverator as http://localhost:18080 (admin / adminadmin) and
 * http://localhost:18081 (API key: mock-api-key).
 */
const qb = createQbMock();
const sab = createSabMock();
const qbPort = Number(process.env.MOCK_QB_PORT || 18080);
const sabPort = Number(process.env.MOCK_SAB_PORT || 18081);

serve({ fetch: qb.app.fetch, port: qbPort }, () => console.log(`mock qBittorrent on http://localhost:${qbPort} (admin / adminadmin)`));
serve({ fetch: sab.app.fetch, port: sabPort }, () => console.log(`mock SABnzbd on http://localhost:${sabPort} (API key: mock-api-key)`));

setInterval(() => {
  qb.advance(1);
  sab.advance(1);
}, 1000);
