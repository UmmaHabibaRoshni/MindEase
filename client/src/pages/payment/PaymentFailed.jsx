import React from "react";
import { useSearchParams } from "react-router-dom";
import ResultCard from "./ResultCard";

// GET /payment/fail?reason=...  (T17.9)
// The reason codes are the ones the backend sends in T17.4. Each says whether
// money may have left the seeker's account, because that changes what they
// should do next.
export const REASONS = {
  gateway: {
    text: "The payment did not go through at the gateway. No seat was taken and you have not been charged.",
    charged: false,
  },
  verify: {
    text: "We could not confirm this payment with the gateway, so you have not been enrolled.",
    charged: true,
  },
  unavailable: {
    text: "Your payment went through, but the workshop filled up or was cancelled before we could give you a seat.",
    charged: true,
  },
  invalid: {
    text: "We could not match this payment to a booking. No seat was taken.",
    charged: false,
  },
  error: {
    text: "Something went wrong on our side while finishing the payment.",
    charged: true,
  },
};

const FALLBACK = {
  text: "The payment did not complete, so you have not been enrolled.",
  charged: true,
};

export default function PaymentFailed() {
  const [params] = useSearchParams();
  const reason = params.get("reason");
  const detail = REASONS[reason] || FALLBACK;

  return (
    <ResultCard
      tone="failed"
      title="Payment did not complete"
      actions={[
        { to: "/dashboard/workshops", label: "Back to workshops", primary: true },
        { to: "/dashboard/seeker", label: "Back to dashboard" },
      ]}
    >
      <p style={{ margin: "0 0 12px" }}>{detail.text}</p>

      {detail.charged ? (
        <p style={{ margin: "0 0 12px" }}>
          <strong>If money has left your account, do not pay again.</strong> Contact
          us and we will sort it out by hand - the app cannot issue refunds itself.
        </p>
      ) : (
        <p style={{ margin: "0 0 12px" }}>You can safely try again from the workshops list.</p>
      )}

      {reason && (
        <p style={{ margin: 0, color: "#718096", fontSize: "13px" }}>
          Reference code: <code>{reason}</code>
        </p>
      )}
    </ResultCard>
  );
}
