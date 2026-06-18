"use client";

import { useRouter } from "next/navigation";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

interface Props {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "lg" | "xl" | "xxl" | "icon" | "default";
}

export function HeroLiquidButton({ href, children, size = "xl" }: Props) {
  const router = useRouter();
  return (
    <LiquidButton
      size={size}
      className="font-semibold text-base tracking-wide"
      onClick={() => router.push(href)}
    >
      {children}
    </LiquidButton>
  );
}
