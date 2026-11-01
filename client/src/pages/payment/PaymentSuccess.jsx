import React from "react";
import { useSearchParams } from "react-router-dom";
import ResultCard from "./ResultCard";

// GET /payment/success?workshop=<id>  (T17.9)
// The backend only redirects here after SSLCommerz confirmed the payment AND
// the enrollment was created, so by the time this page renders the seat is taken.
export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const workshopId = params.get("workshop");

  return (
    <ResultCard
      tone="success"
      title="Payment complete - you are enrolled"
      actions={[
        { to: "/dashboard/workshops", label: "View my workshops", primary: true },
        { to: "/dashboard/seeker", label: "Back to dashboard" },
      ]}
    >
      <p style={{ margin: "0 0 12px" }}>
        Your payment went through and your seat is booked. The workshop now shows
        as enrolled in your workshops list.
      </p>
      {workshopId && (
        <p style={{ margin: 0, color: "#718096", fontSize: "13px" }}>
          Workshop reference: <code>{workshopId}</code>
        </p>
      )}
    </ResultCard>
  );
}
