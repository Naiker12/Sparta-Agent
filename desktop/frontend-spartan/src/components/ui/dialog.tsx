
"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { createContext, useContext } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const DialogPortalContainerContext = createContext<HTMLElement | null>(null);

export function useDialogPortalContainer(): HTMLElement | null {
  return useContext(DialogPortalContainerContext);
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ ...props }, ref) => (
  <DialogPrimitive.Trigger ref={ref} data-slot="dialog-trigger" {...props} />
));
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ ...props }, ref) => (
  <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />
));
DialogClose.displayName = DialogPrimitive.Close.displayName;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
    position?: "fixed" | "absolute";
  }
>(({ className, position = "fixed", ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/30 supports-backdrop-filter:backdrop-blur-[2px] duration-100 inset-0 isolate z-50",
      position === "fixed" ? "fixed" : "absolute",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    container?: HTMLElement | null;
    position?: "fixed" | "absolute";
    overlayClassName?: string;
    overlayPosition?: "fixed" | "absolute";
  }
>(
  (
    {
      className,
      children,
      showCloseButton = true,
      container,
      position = "fixed",
      overlayClassName,
      overlayPosition,
      ...props
    },
    ref,
  ) => {
    const resolvedContainer = container ?? null;
    return (
      <DialogPortalContainerContext.Provider value={resolvedContainer}>
        <DialogPortal container={resolvedContainer ?? undefined}>
          <DialogOverlay
            className={overlayClassName}
            position={overlayPosition ?? position}
          />
          <DialogPrimitive.Content
            ref={ref}
            data-slot="dialog-content"
            className={cn(
              "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 grid max-h-[calc(100dvh-var(--studio-window-chrome-top,0px)-2rem)] max-w-[calc(100%-2rem)] gap-6 overflow-y-auto rounded-4xl px-7 pt-8 pb-7 text-sm ring-1 duration-100 sm:max-w-md top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
              position === "fixed"
                ? "fixed top-[calc(50%+var(--studio-window-chrome-top,0px)/2)] max-sm:top-[var(--studio-window-chrome-top,0px)] max-sm:left-0 max-sm:h-[calc(100dvh-var(--studio-window-chrome-top,0px))] max-sm:w-dvw max-sm:max-h-none max-sm:max-w-none max-sm:translate-none max-sm:rounded-none max-sm:ring-0"
                : "absolute",
              className,
            )}
            {...props}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close data-slot="dialog-close" asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "absolute top-5 right-5 z-10",
                    position === "fixed" &&
                      "max-sm:fixed max-sm:top-[calc(1.25rem+var(--studio-window-chrome-top,0px))]",
                  )}
                  size="icon-sm"
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPortalContainerContext.Provider>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("gap-2 flex flex-col", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("font-heading text-lg leading-none font-semibold", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn(
      "text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
      className,
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogPortalContainerContext,
  DialogTitle,
  DialogTrigger,
};
