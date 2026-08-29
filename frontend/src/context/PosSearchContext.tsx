"use client";

import React, { createContext, useContext, useState } from "react";

type PosSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const PosSearchContext = createContext<PosSearchContextValue | null>(null);

export function PosSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <PosSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </PosSearchContext.Provider>
  );
}

export function usePosSearch() {
  const ctx = useContext(PosSearchContext);
  if (!ctx) {
    throw new Error("usePosSearch must be used within PosSearchProvider");
  }
  return ctx;
}

export function usePosSearchOptional() {
  return useContext(PosSearchContext);
}
