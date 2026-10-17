import { useRef, type ComponentProps } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// These dialogs open from table rows and activity entries, rather than Dialog.Trigger.
// Remember that element explicitly so keyboard users return to their place on close.
export function CandidateDialog(props: ComponentProps<typeof Dialog.Content>) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  return (
    <Dialog.Content
      {...props}
      ref={content}
      onOpenAutoFocus={(event) => {
        returnFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const field = content.current?.querySelector<HTMLInputElement>("input");
        if (field) {
          event.preventDefault();
          field.focus();
        }
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        requestAnimationFrame(() => {
          if (!document.querySelector('[role="dialog"]')) {
            const target = returnFocus.current?.isConnected
              ? returnFocus.current
              : document.querySelector<HTMLElement>(
                  "main .page-heading .primary",
                );
            target?.focus({ preventScroll: true });
          }
        });
      }}
    />
  );
}
