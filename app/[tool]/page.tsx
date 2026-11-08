import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { placeholderPages } from "@/lib/nav";
import { cn } from "@/lib/utils";

// "준비 중" pages for tools in the menu that are not built yet (lib/nav.ts).
// A real tool gets its own folder (e.g. app/income/), which takes precedence
// over this dynamic segment; any slug not listed here is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return placeholderPages.map((p) => ({ tool: p.slug }));
}

type Props = { params: Promise<{ tool: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  const page = placeholderPages.find((p) => p.slug === tool);
  return page ? { title: page.title } : {};
}

export default async function PlaceholderPage({ params }: Props) {
  const { tool } = await params;
  const page = placeholderPages.find((p) => p.slug === tool);
  if (!page) notFound();
  const Icon = page.icon ?? Construction;

  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]">
      <PageHeader title={page.title} description={page.description} />
      <section className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card px-5 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <Badge variant="outline" className="text-muted-foreground">
          준비 중
        </Badge>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          지금 만들고 있어요. 그동안 분배금 계산기는 바로 쓸 수 있어요.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/boss-split" className={cn(buttonVariants(), "h-10 rounded-lg px-4 font-bold")}>
            분배금 계산기
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-lg px-4")}>
            홈으로
          </Link>
        </div>
      </section>
    </div>
  );
}
