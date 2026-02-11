import { Suspense } from "react";
import AppClient from "./AppClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <AppClient />
    </Suspense>
  );
}
