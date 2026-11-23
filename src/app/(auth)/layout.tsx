import { Suspense } from "react";
import { Flash } from "@/components/client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <Flash />
      </Suspense>
      {children}
    </>
  );
}
