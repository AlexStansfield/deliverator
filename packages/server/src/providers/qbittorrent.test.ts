import { describe, it, expect } from "vitest";
import { QBittorrentAdapter, mapQbState } from "./qbittorrent.js";
import { createQbMock } from "../mock/qbittorrent-mock.js";

const make = (opts: Parameters<typeof createQbMock>[0] = {}, password = "adminadmin") => {
  const mock = createQbMock(opts);
  const adapter = new QBittorrentAdapter("qb1", "http://qb.local:8080", "admin", password, { fetch: mock.fetch });
  return { mock, adapter };
};

describe("QBittorrentAdapter", () => {
  it("maps every known state into the shared vocabulary", () => {
    expect(mapQbState("downloading").state).toBe("downloading");
    expect(mapQbState("stalledDL").state).toBe("downloading");
    expect(mapQbState("queuedDL").state).toBe("queued");
    expect(mapQbState("pausedDL").state).toBe("paused");
    expect(mapQbState("stoppedDL").state).toBe("paused");
    expect(mapQbState("uploading").state).toBe("seeding");
    expect(mapQbState("stoppedUP").state).toBe("completed");
    expect(mapQbState("missingFiles")).toEqual({ state: "failed", error: "Files are missing on disk" });
    expect(mapQbState("checkingResumeData").state).toBe("checking");
  });

  it("logs in and reports version", async () => {
    const { adapter } = make();
    expect(await adapter.testConnection()).toEqual({ version: "v5.0.2" });
  });

  it("fails clearly on wrong password", async () => {
    const { adapter } = make({}, "nope");
    await expect(adapter.testConnection()).rejects.toThrow(/username or password/);
  });

  it("polls and normalises torrents", async () => {
    const { adapter } = make();
    const r = await adapter.poll();
    expect(r.status.version).toBe("v5.0.2");
    expect(r.status.freeSpace).toBe(68_500_000_000);
    expect(r.status.downloadSpeed).toBe(6_200_000);
    expect(r.categories).toEqual(["linux-isos", "movies", "tv"]);
    const ubuntu = r.downloads.find((d) => d.name.startsWith("ubuntu"))!;
    expect(ubuntu.id).toBe(`qb1:${ubuntu.nativeId}`);
    expect(ubuntu.state).toBe("downloading");
    expect(ubuntu.progress).toBeCloseTo(0.62);
    expect(ubuntu.eta).toBeGreaterThan(0);
    expect(ubuntu.torrent?.ratio).toBeCloseTo(0.11);
    expect(r.downloads.find((d) => d.name.startsWith("Tears"))?.state).toBe("failed");
    expect(r.downloads.find((d) => d.name.startsWith("Big Buck"))?.eta).toBeNull();
  });

  it("uses stop/start on 5.x and pause/resume on 4.x", async () => {
    const v5 = make();
    const h = v5.mock.state.torrents[0]!.hash;
    await v5.adapter.pause([h]);
    expect(v5.mock.state.calls.at(-1)?.path).toBe("/api/v2/torrents/stop");
    expect(v5.mock.state.torrents[0]!.state).toBe("stoppedDL");
    await v5.adapter.resume([h]);
    expect(v5.mock.state.calls.at(-1)?.path).toBe("/api/v2/torrents/start");

    const v4 = make({ version: "v4.6.5" });
    await v4.adapter.pause([v4.mock.state.torrents[0]!.hash]);
    expect(v4.mock.state.calls.at(-1)?.path).toBe("/api/v2/torrents/pause");
    await v4.adapter.pauseAll();
    expect(v4.mock.state.calls.at(-1)?.body.hashes).toBe("all");
  });

  it("adds, re-prioritises, recategorises and deletes", async () => {
    const { adapter, mock } = make();
    const before = mock.state.torrents.length;
    await adapter.add({ urls: ["magnet:?xt=urn:btih:abc&dn=hello.iso"], category: "linux-isos", paused: true });
    expect(mock.state.torrents.length).toBe(before + 1);
    const added = mock.state.torrents.at(-1)!;
    expect(added.name).toBe("hello.iso");
    expect(added.state).toBe("stoppedDL");
    await adapter.moveToTop([added.hash]);
    expect(mock.state.torrents[0]!.hash).toBe(added.hash);
    await adapter.setCategory([added.hash], "movies");
    expect(added.category).toBe("movies");
    await adapter.remove([added.hash], true);
    expect(mock.state.calls.at(-1)?.body.deleteFiles).toBe("true");
    expect(mock.state.torrents.length).toBe(before);
  });

  it("sets speed limits and toggles alternative limits", async () => {
    const { adapter, mock } = make();
    await adapter.setSpeedLimits({ download: 5_000_000, upload: 1_000_000 });
    expect(mock.state.dlLimit).toBe(5_000_000);
    expect(mock.state.ulLimit).toBe(1_000_000);
    await adapter.setSpeedLimits({ altEnabled: true });
    expect(mock.state.altMode).toBe(true);
    await adapter.setSpeedLimits({ altEnabled: true });
    expect(mock.state.altMode).toBe(true);
    await adapter.setSpeedLimits({ altEnabled: false });
    expect(mock.state.altMode).toBe(false);
  });

  it("re-logs in when the session expires", async () => {
    const { adapter, mock } = make();
    await adapter.poll();
    mock.state.sid = "rotated";
    const r = await adapter.poll();
    expect(r.downloads.length).toBeGreaterThan(0);
  });

  it("lists files", async () => {
    const { adapter, mock } = make();
    const files = await adapter.files(mock.state.torrents[0]!.hash);
    expect(files).toHaveLength(2);
    expect(files[1]).toEqual({ name: "SHA256SUMS", size: 1200, progress: 1 });
  });
});
