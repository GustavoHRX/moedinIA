import Image from "next/image";

type ThemedLogoProps = {
  variant?: "full" | "symbol";
  className?: string;
  priority?: boolean;
};

export default function ThemedLogo({
  variant = "full",
  className = "",
  priority = false,
}: ThemedLogoProps) {
  const isFull = variant === "full";
  const sizeClass = className || (isFull ? "h-[54px] w-[160px]" : "h-12 w-12");
  const fitClass = isFull ? "object-cover object-center" : "object-contain";

  return (
    <span className={`relative inline-flex shrink-0 items-center overflow-hidden ${sizeClass}`}>
      <Image
        src={isFull ? "/moedinha.png" : "/moedinhagrande.png"}
        alt={isFull ? "Moedin.IA" : "Símbolo IA do Moedin.IA"}
        fill
        sizes={isFull ? "240px" : "64px"}
        className={`theme-logo-light ${fitClass}`}
        priority={priority}
      />
      <Image
        src={isFull ? "/moedinha_branco.png" : "/logo_branco.png"}
        alt={isFull ? "Moedin.IA" : "Símbolo IA do Moedin.IA"}
        fill
        sizes={isFull ? "240px" : "64px"}
        className={`theme-logo-dark ${fitClass}`}
        priority={priority}
      />
    </span>
  );
}
