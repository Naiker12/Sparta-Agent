import { lazy, Suspense, type ReactNode } from "react";

type AvatarProps = {
  name: string;
  animate?: "hover" | "always";
  size?: number;
  className?: string;
  fallback?: ReactNode;
};

const Blobatar = lazy(() =>
  import("@blobatar/react").then(({ Blobatar: Component }) => ({
    default: Component,
  })),
);

const ThinkingBlobatar = lazy(async () => {
  const [{ Blobatar: Component }, { thinking }] = await Promise.all([
    import("@blobatar/react"),
    import("blobatar/expression"),
  ]);
  return {
    default: ({ name, size, className }: Omit<AvatarProps, "animate" | "fallback">) => (
      <Component
        name={name}
        animate="always"
        expression={thinking}
        size={size}
        className={className}
        aria-hidden="true"
      />
    ),
  };
});

export function GeneratedAvatar({ fallback = null, ...props }: AvatarProps) {
  return (
    <Suspense fallback={fallback}>
      <Blobatar {...props} alt="" aria-hidden="true" />
    </Suspense>
  );
}

export function ThinkingAvatar({ fallback = null, ...props }: Omit<AvatarProps, "animate">) {
  return (
    <Suspense fallback={fallback}>
      <ThinkingBlobatar {...props} />
    </Suspense>
  );
}
