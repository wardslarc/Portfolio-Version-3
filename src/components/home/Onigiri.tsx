interface OnigiriProps {
  variant: "logo" | "drawing";
  className?: string;
  "data-anim"?: string;
}

export default function Onigiri({
  variant,
  className,
  "data-anim": dataAnim,
}: OnigiriProps) {
  if (variant === "logo") {
    return (
      <svg
        viewBox="0 0 200 200"
        width={30}
        height={30}
        fill="none"
        stroke="currentColor"
        strokeWidth={12}
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        <path d="M100 22 C112 22 120 30 128 44 L176 128 C188 150 176 174 150 174 L50 174 C24 174 12 150 24 128 L72 44 C80 30 88 22 100 22 Z" />
        <path d="M74 174 L74 128 L126 128 L126 174 Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="#FF6A47"
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-anim={dataAnim}
    >
      <path
        pathLength={1000}
        data-anim="hero-onigiri-path"
        d="M100 22 C112 22 120 30 128 44 L176 128 C188 150 176 174 150 174 L50 174 C24 174 12 150 24 128 L72 44 C80 30 88 22 100 22 Z"
      />
      <path
        pathLength={1000}
        data-anim="hero-onigiri-path"
        d="M74 174 L74 128 L126 128 L126 174"
      />
      <path
        pathLength={1000}
        data-anim="hero-onigiri-path"
        d="M80 92 q6 -8 12 0 M108 92 q6 -8 12 0 M92 106 q8 8 16 0"
      />
    </svg>
  );
}
