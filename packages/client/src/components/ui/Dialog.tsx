import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/55 data-[state=open]:animate-in" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-[max(40px,env(safe-area-inset-top))] z-50 grid max-h-[calc(100dvh-80px)] w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 gap-3.5 overflow-y-auto rounded-2xl border border-line bg-panel p-4.5 shadow-2xl outline-none",
            className,
          )}
        >
          <div className="flex items-start gap-3">
            <div className="grid gap-0.5">
              <RadixDialog.Title className="text-[15px] font-extrabold">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="text-[12.5px] text-muted">{description}</RadixDialog.Description> : null}
            </div>
            <RadixDialog.Close className="ml-auto rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
