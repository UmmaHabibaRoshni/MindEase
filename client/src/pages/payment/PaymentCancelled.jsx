import React from "react";
import ResultCard from "./ResultCard";

// GET /payment/cancel  (T17.9)
// The seeker backed out on the gateway page. The backend marks the pending
// payment cancelled; no seat was ever held, so there is nothing to undo.
export default function PaymentCancelled() {
  return (
    <ResultCard
      tone="cancelled"
      title="Payment cancelled"
      actions={[
        { to: "/dashboard/workshops", label: "Back to workshops", primary: true },
        { to: "/dashboard/seeker", label: "Back to dashboard" },
      ]}
    >
      <p style={{ margin: "0 0 12px" }}>
        You cancelled the payment, so you have not been charged and no seat was
        taken.
      </p>
      <p style={{ margin: 0 }}>
        The workshop is still open - you can pay and enroll whenever you like.
      </p>
    </ResultCard>
  );
}
