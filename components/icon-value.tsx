import Image from "next/image";
import type { ReactNode } from "react";

export function IconValue({
  icon,
  alt,
  children,
  size = 18,
}: {
  icon: string;
  alt: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Image src={icon} alt={alt} width={size} height={size} className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
