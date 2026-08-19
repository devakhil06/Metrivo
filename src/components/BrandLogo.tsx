import Image from "next/image";

interface BrandLogoProps {
  size?: number;
  priority?: boolean;
  className?: string;
}

export default function BrandLogo({ size = 36, priority = false, className = "" }: BrandLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[28%] border border-[rgba(155,255,118,.28)] bg-[#102018] shadow-[0_8px_28px_rgba(155,255,118,.12)] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/metrivo-logo.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
