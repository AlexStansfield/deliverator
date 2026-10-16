import { describe, it, expect } from "vitest";
import { SABnzbdAdapter, parseTimeleft, mapSabHistoryStatus } from "./sabnzbd.js";
import { createSabMock } from "../mock/sabnzbd-mock.js";

const make = (key = "mock-api-key") => {
  const mock = createSabMock();
  const adapter = new SABnzbdAdapter("sab1", "http://sab.local:8080/", key, { fetch: mock.fetch });
  return { mock, adapter };
};

describe("SABnzbdAdapter", () => {
  it("parses time left", () => {
    expect(parseTimeleft("0:04:21")).toBe(261);
    expect(parseTimeleft("1:02:03:04")).toBe(93784);
    expect(parseTimeleft(undefined)).toBeNull();
  });

  it("maps history statuses", () => {
    expect(mapSabHistoryStatus("Completed").state).toBe("completed");
    expect(mapSabHistoryStatus("Failed").state).toBe("failed");
    expect(mapSabHistoryStatus("Repairing").state).toBe("repairing");
    expect(mapSabHistoryStatus("Extracting").state).toBe("extracting");
  });

  it("tests the connection and rejects bad keys", async () => {
    expect(await make().adapter.testConnection()).toEqual({ version: "4.3.3" });
    await expect(make("wrong").adapter.testConnection()).rejects.toThrow(/API key/i);
  });

  it("polls queue and history into one list", async () => {
    const { adapter } = make();
    const r = await adapter.poll();
    expect(r.status.downloadSpeed).toBe(4300 * 1024);
    expect(r.status.freeSpace).toBeCloseTo(63.82 * 1024 ** 3, -6);
    expect(r.status.limits.download).toBe(0);
    expect(r.categories).toEqual(["iso", "movies", "tv"]);
    const mint = r.downloads.find((d) => d.name.startsWith("linuxmint"))!;
    expect(mint.state).toBe("downloading");
    expect(mint.progress).toBeCloseTo((2900 - 1800) / 2900);
    expect(mint.downloadSpeed).toBe(4300 * 1024);
    expect(mint.eta).toBeGreaterThan(0);
    expect(r.downloads.find((d) => d.name.startsWith("archlinux"))?.state).toBe("queued");
    expect(r.downloads.find((d) => d.name.startsWith("debian"))?.state).toBe("repairing");
    const failed = r.downloads.find((d) => d.name.startsWith("Tears"))!;
    expect(failed.state).toBe("failed");
    expect(failed.error).toMatch(/missing articles/);
    expect(r.downloads.find((d) => d.name.startsWith("Sintel"))?.savePath).toContain("/downloads/complete");
  });

  it("marks everything paused when the queue is paused", async () => {
    const { adapter, mock } = make();
    await adapter.pauseAll();
    expect(mock.state.paused).toBe(true);
    const r = await adapter.poll();
    expect(r.status.paused).toBe(true);
    expect(r.downloads.find((d) => d.name.startsWith("linuxmint"))?.state).toBe("paused");
    await adapter.resumeAll();
    expect(mock.state.paused).toBe(false);
  });

  it("adds by URL and by file", async () => {
    const { adapter, mock } = make();
    const before = mock.state.items.length;
    await adapter.add({ urls: ["https://indexer.example/get/123/thing.nzb"], category: "tv", paused: true });
    await adapter.add({ files: [{ name: "upload.nzb", data: Buffer.from("<nzb/>") }] });
    expect(mock.state.items.length).toBe(before + 2);
    expect(mock.state.items.at(-2)).toMatchObject({ name: "thing", cat: "tv", status: "Paused" });
    expect(mock.state.items.at(-1)).toMatchObject({ name: "upload", status: "Queued" });
  });

  it("pauses, resumes, retries, reorders and deletes", async () => {
    const { adapter, mock } = make();
    const id = "SABnzbd_nzo_a1";
    await adapter.pause([id]);
    expect(mock.state.items[0]!.status).toBe("Paused");
    await adapter.resume([id]);
    expect(mock.state.items[0]!.status).toBe("Downloading");
    await adapter.moveToTop(["SABnzbd_nzo_b2"]);
    expect(mock.state.items[0]!.nzo_id).toBe("SABnzbd_nzo_b2");
    await adapter.retry(["SABnzbd_nzo_e5"]);
    expect(mock.state.items.find((i) => i.nzo_id === "SABnzbd_nzo_e5")).toMatchObject({ inQueue: true, status: "Queued" });
    await adapter.remove(["SABnzbd_nzo_d4", "SABnzbd_nzo_a1"], true);
    expect(mock.state.items.some((i) => i.nzo_id === "SABnzbd_nzo_d4")).toBe(false);
    expect(mock.state.items.some((i) => i.nzo_id === "SABnzbd_nzo_a1")).toBe(false);
    expect(mock.state.calls.filter((c) => c.name === "delete").every((c) => c.del_files === "1")).toBe(true);
  });

  it("sets and clears the speed limit", async () => {
    const { adapter, mock } = make();
    await adapter.setSpeedLimits({ download: 5 * 1024 * 1024 });
    expect(mock.state.speedLimitAbs).toBe(5 * 1024 * 1024);
    expect((await adapter.poll()).status.limits.download).toBe(5 * 1024 * 1024);
    await adapter.setSpeedLimits({ download: 0 });
    expect(mock.state.speedLimitAbs).toBe(0);
  });
});
