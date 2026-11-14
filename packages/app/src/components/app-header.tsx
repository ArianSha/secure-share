import Image from "next/image";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center px-6">
      <Link
        href="/share"
        className="inline-flex items-center gap-2"
        aria-label="Secure Share home"
      >
        <Image
          className="size-10 rounded-md"
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          loading="eager"
        />
        <span className="font-heading text-xl font-semibold">
          secure
          <span className="ml-1 font-normal text-muted-foreground">share</span>
        </span>
      </Link>
    </header>
  );
}
