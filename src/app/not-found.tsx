import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="eyebrow">404</span>
        <h1 className="text-3xl font-bold tracking-tight">This page does not exist</h1>
        <p className="max-w-md text-muted-foreground">
          The link may be outdated. Head back to the landing page to continue browsing.
        </p>
        <Button variant="brand" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
