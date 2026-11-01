// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

// T17.11 - the three pages SSLCommerz redirects the seeker back to (T17.9).
// They are plain presentational pages, so these tests drive them through a
// MemoryRouter with the query string the backend actually sends.

import PaymentSuccess from "../pages/payment/PaymentSuccess";
import PaymentFailed, { REASONS } from "../pages/payment/PaymentFailed";
import PaymentCancelled from "../pages/payment/PaymentCancelled";

afterEach(() => {
  cleanup();
});

const at = (path, element) =>
  render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

// ---------- /payment/success ----------

describe("PaymentSuccess", () => {
  it("says the seeker is enrolled", () => {
    at("/payment/success?workshop=w1", <PaymentSuccess />);
    expect(screen.getByRole("heading")).toHaveTextContent(/you are enrolled/i);
    expect(screen.getByText(/your seat is booked/i)).toBeInTheDocument();
  });

  it("shows the workshop reference the backend sent", () => {
    at("/payment/success?workshop=6ace99e5a97b2180cfb043ef", <PaymentSuccess />);
    expect(screen.getByText("6ace99e5a97b2180cfb043ef")).toBeInTheDocument();
  });

  it("still renders when the workshop id is missing", () => {
    at("/payment/success", <PaymentSuccess />);
    expect(screen.getByRole("heading")).toHaveTextContent(/you are enrolled/i);
    expect(screen.queryByText(/workshop reference/i)).not.toBeInTheDocument();
  });

  it("offers a way back to the workshops list", () => {
    at("/payment/success?workshop=w1", <PaymentSuccess />);
    expect(screen.getByRole("link", { name: /view my workshops/i })).toHaveAttribute(
      "href",
      "/dashboard/workshops"
    );
  });
});

// ---------- /payment/fail ----------

describe("PaymentFailed", () => {
  it("always says the seeker was not enrolled", () => {
    at("/payment/fail?reason=gateway", <PaymentFailed />);
    expect(screen.getByRole("heading")).toHaveTextContent(/did not complete/i);
  });

  it("tells a seeker whose card was never charged that it is safe to retry", () => {
    at("/payment/fail?reason=gateway", <PaymentFailed />);
    expect(screen.getByText(/you have not been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/safely try again/i)).toBeInTheDocument();
  });

  it("warns against paying twice when money may already have gone", () => {
    at("/payment/fail?reason=verify", <PaymentFailed />);
    expect(screen.getByText(/do not pay again/i)).toBeInTheDocument();
    expect(screen.queryByText(/safely try again/i)).not.toBeInTheDocument();
  });

  it("explains the paid-but-no-seat case, which needs a human", () => {
    at("/payment/fail?reason=unavailable", <PaymentFailed />);
    expect(screen.getByText(/filled up or was cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot issue refunds/i)).toBeInTheDocument();
  });

  it("shows the reason code so it can be quoted when asking for help", () => {
    at("/payment/fail?reason=verify", <PaymentFailed />);
    expect(screen.getByText("verify")).toBeInTheDocument();
  });

  it("falls back to a safe message for an unknown reason", () => {
    at("/payment/fail?reason=something-new", <PaymentFailed />);
    expect(screen.getByText(/did not complete, so you have not been enrolled/i)).toBeInTheDocument();
    expect(screen.getByText(/do not pay again/i)).toBeInTheDocument();
  });

  it("falls back the same way when there is no reason at all", () => {
    at("/payment/fail", <PaymentFailed />);
    expect(screen.getByText(/did not complete, so you have not been enrolled/i)).toBeInTheDocument();
    expect(screen.queryByText(/reference code/i)).not.toBeInTheDocument();
  });

  it("covers every reason code the backend can send", () => {
    // these are the codes in paymentController.js (T17.4)
    expect(Object.keys(REASONS).sort()).toEqual(
      ["error", "gateway", "invalid", "unavailable", "verify"].sort()
    );
  });

  it.each(Object.keys(REASONS))("renders a message for reason=%s", (reason) => {
    at(`/payment/fail?reason=${reason}`, <PaymentFailed />);
    expect(screen.getByRole("heading")).toHaveTextContent(/did not complete/i);
    expect(screen.getByText(REASONS[reason].text)).toBeInTheDocument();
  });
});

// ---------- /payment/cancel ----------

describe("PaymentCancelled", () => {
  it("says nothing was charged and no seat was taken", () => {
    at("/payment/cancel", <PaymentCancelled />);
    expect(screen.getByRole("heading")).toHaveTextContent(/cancelled/i);
    expect(screen.getByText(/not been charged and no seat was taken/i)).toBeInTheDocument();
  });

  it("tells the seeker they can still pay later", () => {
    at("/payment/cancel", <PaymentCancelled />);
    expect(screen.getByText(/still open/i)).toBeInTheDocument();
  });

  it("links back to the workshops list", () => {
    at("/payment/cancel", <PaymentCancelled />);
    expect(screen.getByRole("link", { name: /back to workshops/i })).toHaveAttribute(
      "href",
      "/dashboard/workshops"
    );
  });
});
