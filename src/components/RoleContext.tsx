"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<"admin" | "operador">("admin");

export function RoleProvider({
  role,
  children,
}: {
  role: "admin" | "operador";
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
