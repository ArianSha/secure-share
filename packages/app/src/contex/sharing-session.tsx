"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

type SharingSession = {
  recipientEmail: string | null;
  setRecipientEmail: (email: string | null) => void;
};

const SharingSessionContext = createContext<SharingSession | null>(null);

export function SharingSessionProvider({ children }: { children: ReactNode }) {
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);

  return (
    <SharingSessionContext value={{ recipientEmail, setRecipientEmail }}>
      {children}
    </SharingSessionContext>
  );
}

export function useSharingSession() {
  const session = useContext(SharingSessionContext);
  if (!session) {
    throw new Error("useSharingSession requires a SharingSessionProvider");
  }
  return session;
}
