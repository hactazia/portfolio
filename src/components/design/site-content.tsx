"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchContacts, type ContactRow } from "@/lib/contacts";
import { fetchSiteContent, type SiteContent } from "@/lib/site";
import { fetchStack, type StackGroup } from "@/lib/stack";

/**
 * The three things the whole page needs, fetched once at the top of the tree.
 *
 * - `site`: brand, mark and hero statement (`GET /api/site`).
 * - `contacts`: the contact rows (`GET /api/contacts`), shared by the navbar
 *   CTA, the footer's "Elsewhere" column and the contact section — that is how
 *   the email ends up stated exactly once.
 * - `stack`: the grouped tooling (`GET /api/stack`), read by the stack band on
 *   the home page and by the `/stack` page.
 *
 * `null` means "nothing retrieved yet"; consumers render skeletons.
 */
const SiteContentContext = createContext<SiteContent | null>(null);
const ContactsContext = createContext<ContactRow[] | null>(null);
const StackContext = createContext<StackGroup[] | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteContent | null>(null);
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [stack, setStack] = useState<StackGroup[] | null>(null);

  useEffect(() => {
    let live = true;

    // Failures are silent on purpose: the skeletons stay up, nothing is invented.
    fetchSiteContent()
      .then((data) => {
        if (live) setSite(data);
      })
      .catch(() => {});

    fetchContacts()
      .then((data) => {
        if (live) setContacts(data);
      })
      .catch(() => {});

    fetchStack()
      .then((data) => {
        if (live) setStack(data);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return (
    <SiteContentContext.Provider value={site}>
      <ContactsContext.Provider value={contacts}>
        <StackContext.Provider value={stack}>{children}</StackContext.Provider>
      </ContactsContext.Provider>
    </SiteContentContext.Provider>
  );
}

export function useSiteContent(): SiteContent | null {
  return useContext(SiteContentContext);
}

export function useContacts(): ContactRow[] | null {
  return useContext(ContactsContext);
}

export function useStack(): StackGroup[] | null {
  return useContext(StackContext);
}
