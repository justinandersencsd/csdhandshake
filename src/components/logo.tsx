import Image from "next/image";

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/CIClogo.png"
      alt="Canyons Innovation Center"
      width={128}
      height={128}
      className={`${className} object-contain rounded-md`}
      priority
    />
  );
}