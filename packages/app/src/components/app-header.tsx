import Image from "next/image";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="flex h-14 items-center border-b border-border px-5 min-[540px]:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-[11px] text-[19px] font-[650] tracking-[-0.9px] min-[540px]:text-[21px]"
        aria-label="Secure Share home"
      >
        <Image
          className="block size-10 rounded-[8px] object-contain"
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          loading="eager"
        />
        <span>
          secure
          <span className="ml-[3px] font-normal text-muted-foreground">
            share
          </span>
        </span>
      </Link>
    </header>
  );
}
