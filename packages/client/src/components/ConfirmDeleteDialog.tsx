import { useEffect, useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";

export function ConfirmDeleteDialog({
  open,
  count,
  canDeleteFiles,
  defaultDeleteFiles,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  canDeleteFiles: boolean;
  defaultDeleteFiles: boolean;
  onCancel: () => void;
  onConfirm: (deleteFiles: boolean) => void;
}) {
  const [deleteFiles, setDeleteFiles] = useState(defaultDeleteFiles);
  useEffect(() => {
    if (open) setDeleteFiles(defaultDeleteFiles);
  }, [open, defaultDeleteFiles]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()} title={count === 1 ? "Delete this download?" : `Delete ${count} downloads?`}>
      <p className="text-[13px] text-muted">{canDeleteFiles ? "Removing from the client is immediate. You can also delete the downloaded files from disk." : "This removes the entry from the client."}</p>
      {canDeleteFiles ? <Switch id="delete-files" label="Also delete files from disk" checked={deleteFiles} onCheckedChange={setDeleteFiles} /> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" className="bg-bad text-white" onClick={() => onConfirm(canDeleteFiles && deleteFiles)}>
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
