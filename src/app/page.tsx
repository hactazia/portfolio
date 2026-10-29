import type { Metadata } from "next";

import { PageShell } from "@/components/design/page-shell";
import { About } from "@/components/design/sections/about";
import { Contacts } from "@/components/design/sections/contacts";
import { Hero } from "@/components/design/sections/hero";
import { ProjectList } from "@/components/design/sections/project-list";
import { Showcase } from "@/components/design/sections/showcase";
import { StackLab } from "@/components/design/sections/stack-lab";

export const metadata: Metadata = {
  title: { absolute: "Hactazia — Independent IT engineer" },
  description:
    "Web platforms, Unity tooling and VR in production — built end to end by Hactazia.",
};

export default function HomePage() {
  return (
    <PageShell>
      <Hero />
      <ProjectList />
      <Showcase />
      <About />
      <Contacts />
      <StackLab />
    </PageShell>
  );
}
