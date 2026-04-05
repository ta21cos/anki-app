"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
