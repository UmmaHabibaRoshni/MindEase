// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// T17.10 - the paid-workshop parts of the UI: the price field on the create
// form, the price on a seeker's workshop card, and the Pay & Enroll button.
// Both API helpers are mocked, so no server and no real navigation.

vi.mock("../api/workshopApi", () => ({
  getAvailableWorkshops: vi.fn(),
  enrollInWorkshop: vi.fn(),
  cancelEnrollment: vi.fn(),
  createWorkshop: vi.fn(),
  errorMessage: (err, fallback) => err.response?.data?.message || fallback,
}));

vi.mock("../api/paymentApi", () => ({
  startWorkshopPayment: vi.fn(),
  goToGateway: vi.fn(),
  errorMessage: (err, fallback) => err.response?.data?.message || fallback,
}));

import * as workshopApi from "../api/workshopApi";
import * as paymentApi from "../api/paymentApi";
import Workshops from "../pages/seeker/Workshops";
import CreateWorkshop from "../pages/facilitator/CreateWorkshop";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
});

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

const workshop = (overrides = {}) => ({
  _id: "w1",
  title: "Exam Stress Workshop",
  description: "A guided session on handling exam pressure.",
  date: future,
  time: "10:30 AM",
  durationMinutes: 60,
  mode: "Online",
  capacity: 5,
  seatsAvailable: 3,
  isFull: false,
  facilitator: { name: "Test Facilitator" },
  ...overrides,
});

const paid = (overrides = {}) => workshop({ price: 500, isPaid: true, ...overrides });

// ---------- T17.7: the price field on the create form ----------

describe("Create workshop: price field", () => {
  const fillRequired = async (user) => {
    await user.type(screen.getByLabelText("Title"), "Managing exam stress");
    await user.type(
      screen.getByLabelText("Description"),
      "A practical session on grounding techniques for students."
    );
    const iso = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const dateInput = screen.getByLabelText("Date");
    const timeInput = screen.getByLabelText("Start time");
    await user.clear(dateInput);
    await user.type(dateInput, iso);
    await user.clear(timeInput);
    await user.type(timeInput, "10:30");
    await user.type(
      screen.getByLabelText("Meeting link or address"),
      "https://meet.example.com/x"
    );
  };

  it("shows a price field that is blank by default", () => {
    render(<CreateWorkshop />);
    const price = screen.getByLabelText("Price (BDT)");
    expect(price).toBeInTheDocument();
    expect(price).toHaveValue(null);
  });

  it("leaves price out of the request when it is blank, so the workshop is free", async () => {
    const user = userEvent.setup();
    workshopApi.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /create workshop/i }));

    await waitFor(() => expect(workshopApi.createWorkshop).toHaveBeenCalled());
    const body = workshopApi.createWorkshop.mock.calls[0][0];
    expect(body).not.toHaveProperty("price");
  });

  it("sends the price as a number when one is entered", async () => {
    const user = userEvent.setup();
    workshopApi.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Price (BDT)"), "500");
    await user.click(screen.getByRole("button", { name: /create workshop/i }));

    await waitFor(() => expect(workshopApi.createWorkshop).toHaveBeenCalled());
    expect(workshopApi.createWorkshop.mock.calls[0][0].price).toBe(500);
  });

  it("sends 0 as a price, which the server treats as free", async () => {
    const user = userEvent.setup();
    workshopApi.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Price (BDT)"), "0");
    await user.click(screen.getByRole("button", { name: /create workshop/i }));

    await waitFor(() => expect(workshopApi.createWorkshop).toHaveBeenCalled());
    expect(workshopApi.createWorkshop.mock.calls[0][0].price).toBe(0);
  });

  it("refuses a negative price and does not call the server", async () => {
    const user = userEvent.setup();
    render(<CreateWorkshop />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Price (BDT)"), "-5");
    await user.click(screen.getByRole("button", { name: /create workshop/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/price must be a number/i);
    expect(workshopApi.createWorkshop).not.toHaveBeenCalled();
  });

  it("says the workshop is paid in the success message", async () => {
    const user = userEvent.setup();
    workshopApi.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("Price (BDT)"), "500");
    await user.click(screen.getByRole("button", { name: /create workshop/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/500 BDT/);
  });
});

// ---------- T17.8: price on the card, and Pay & Enroll ----------

describe("Workshops page: price on the card", () => {
  it("marks a workshop with no price as Free and offers plain Enroll", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop()]);
    render(<Workshops />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enroll" })).toBeInTheDocument();
  });

  it("shows the amount for a paid workshop", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    render(<Workshops />);

    expect(await screen.findByText("500 BDT")).toBeInTheDocument();
  });

  it("treats a price above 0 as paid even without the isPaid flag", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop({ price: 250 })]);
    render(<Workshops />);

    expect(await screen.findByText("250 BDT")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pay 250 BDT & enroll/i })
    ).toBeInTheDocument();
  });

  it("treats price 0 as free", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([
      workshop({ price: 0, isPaid: false }),
    ]);
    render(<Workshops />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enroll" })).toBeInTheDocument();
  });
});

describe("Workshops page: Pay & Enroll", () => {
  it("shows a Pay button naming the amount instead of Enroll", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    render(<Workshops />);

    expect(
      await screen.findByRole("button", { name: /pay 500 BDT & enroll/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
  });

  it("sends the seeker to the gateway URL the server returns", async () => {
    const user = userEvent.setup();
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    paymentApi.startWorkshopPayment.mockResolvedValue({
      gatewayUrl: "https://sandbox.sslcommerz.com/pay/abc123",
    });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: /pay 500 BDT & enroll/i }));

    await waitFor(() => expect(paymentApi.startWorkshopPayment).toHaveBeenCalledWith("w1"));
    expect(paymentApi.goToGateway).toHaveBeenCalledWith(
      "https://sandbox.sslcommerz.com/pay/abc123"
    );
  });

  it("never enrolls directly for a paid workshop", async () => {
    const user = userEvent.setup();
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    paymentApi.startWorkshopPayment.mockResolvedValue({ gatewayUrl: "https://gw.example/x" });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: /pay 500 BDT & enroll/i }));

    await waitFor(() => expect(paymentApi.goToGateway).toHaveBeenCalled());
    expect(workshopApi.enrollInWorkshop).not.toHaveBeenCalled();
  });

  it("shows the server's message when the payment cannot be started", async () => {
    const user = userEvent.setup();
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    paymentApi.startWorkshopPayment.mockRejectedValue({
      response: { status: 502, data: { message: "Could not start the payment. Try again." } },
    });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: /pay 500 BDT & enroll/i }));

    expect(await screen.findByText(/could not start the payment/i)).toBeInTheDocument();
    expect(paymentApi.goToGateway).not.toHaveBeenCalled();
  });

  it("stays put when the server answers without a gateway URL", async () => {
    const user = userEvent.setup();
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid()]);
    paymentApi.startWorkshopPayment.mockResolvedValue({});
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: /pay 500 BDT & enroll/i }));

    expect(await screen.findByText(/could not start the payment/i)).toBeInTheDocument();
    expect(paymentApi.goToGateway).not.toHaveBeenCalled();
  });

  it("shows Full rather than a Pay button when the workshop is full", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([
      paid({ isFull: true, seatsAvailable: 0 }),
    ]);
    render(<Workshops />);

    expect(await screen.findByRole("button", { name: "Full" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
  });

  it("warns an enrolled seeker that cancelling a paid workshop is not refunded", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([paid({ isEnrolled: true })]);
    render(<Workshops />);

    expect(await screen.findByText(/does not refund the fee/i)).toBeInTheDocument();
  });

  it("does not show that warning for a free workshop", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: true })]);
    render(<Workshops />);

    expect(await screen.findByText("You are enrolled")).toBeInTheDocument();
    expect(screen.queryByText(/does not refund the fee/i)).not.toBeInTheDocument();
  });
});
