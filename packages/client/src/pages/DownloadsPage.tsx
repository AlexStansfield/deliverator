import { Link } from "react-router";
import { PlugZap } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/** Placeholder until the provider layer lands (build step 2). */
export function DownloadsPage() {
  return (
    <div className="mx-auto grid max-w-[520px] justify-items-center gap-3 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-line bg-panel text-muted">
        <PlugZap className="size-6" />
      </span>
      <h2 className="text-[17px] font-extrabold">No providers yet</h2>
      <p className="text-muted">Connect a qBittorrent or SABnzbd instance and your downloads will show up here as one list.</p>
      <Link to="/settings/providers" className={buttonClass({ variant: "primary" })}>
        Add a provider
      </Link>
    </div>
  );
}
