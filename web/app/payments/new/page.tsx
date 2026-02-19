// web/app/payments/new/page.tsx
import { Suspense } from "react";
import NewPaymentIntentClient from "./NewPaymentIntentClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewPaymentIntentClient />
    </Suspense>
  );
}
