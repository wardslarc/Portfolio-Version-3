import Image from "next/image";
import type { AssetSlot } from "@/content/home";
import styles from "./AssetImage.module.css";

interface AssetImageProps {
  slot: AssetSlot;
  sizes: string;
  className?: string;
  priority?: boolean;
}

export default function AssetImage({
  slot,
  sizes,
  className,
  priority = false,
}: AssetImageProps) {
  if (slot.src) {
    if (slot.width && slot.height) {
      return (
        <Image
          src={slot.src}
          alt={slot.alt}
          width={slot.width}
          height={slot.height}
          sizes={sizes}
          priority={priority}
          className={`${styles.img} ${className ?? ""}`}
        />
      );
    }

    return (
      <Image
        src={slot.src}
        alt={slot.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`${styles.imgFill} ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={slot.alt}
      className={`${styles.placeholder} ${className ?? ""}`}
    >
      <span>{slot.label}</span>
    </div>
  );
}
