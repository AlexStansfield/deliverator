/** Which kind of link is this? Used to route "Add" requests to the right provider. */
export type LinkKind = "torrent" | "nzb" | "unknown";

export function detectLinkKind(input: string): LinkKind {
  const s = input.trim();
  if (/^magnet:/i.test(s)) return "torrent";
  let pathname = s;
  let search = "";
  try {
    const u = new URL(s);
    pathname = u.pathname;
    search = u.search;
  } catch {
    /* not a URL; fall through with the raw string */
  }
  if (/\.torrent$/i.test(pathname)) return "torrent";
  if (/\.nzb$/i.test(pathname)) return "nzb";
  if (/nzb/i.test(pathname) || /nzb/i.test(search)) return "nzb";
  if (/torrent/i.test(pathname) || /torrent/i.test(search)) return "torrent";
  return "unknown";
}

export function detectFileKind(filename: string): LinkKind {
  if (/\.torrent$/i.test(filename)) return "torrent";
  if (/\.nzb(\.gz)?$/i.test(filename)) return "nzb";
  return "unknown";
}
