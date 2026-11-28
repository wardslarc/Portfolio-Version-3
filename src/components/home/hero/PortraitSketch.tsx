interface PortraitSketchProps {
  className?: string;
}

export default function PortraitSketch({ className }: PortraitSketchProps) {
  return (
    <svg
      viewBox="0 0 400 500"
      fill="none"
      stroke="#16161A"
      strokeWidth={2}
      aria-hidden="true"
      className={className}
    >
      <circle cx="200" cy="210" r="110" strokeOpacity=".35" />
      <path d="M200 90 C185 200 185 260 200 380" stroke="#E8492A" />
      <path d="M92 205 C150 222 250 222 308 205" stroke="#E8492A" />
      <path
        d="M120 270 C150 300 175 330 200 345 C225 330 250 300 280 270"
        strokeWidth={3}
      />
      <path
        d="M150 230 q18 -10 34 0 M216 230 q18 -10 34 0 M188 280 q12 8 24 0 M175 312 q25 12 50 0"
        strokeWidth={2.5}
      />
      <path
        d="M96 170 C110 90 170 70 220 82 C270 92 310 130 306 190 M120 120 C150 100 190 112 214 96 M150 110 C190 130 240 120 280 140"
        strokeWidth={2.5}
        strokeOpacity=".7"
      />
      <path
        d="M60 500 C80 430 130 410 200 410 C270 410 320 430 340 500"
        strokeOpacity=".5"
      />
    </svg>
  );
}
