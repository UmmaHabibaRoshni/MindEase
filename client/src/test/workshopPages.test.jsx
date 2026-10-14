
// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Tests for the workshop pages (T12.9).
// The API helper is mocked, so no server runs.

vi.mock("../api/workshopApi", () => ({
  getAvailableWorkshops: vi.fn(),
  enrollInWorkshop: vi.fn(),
  cancelEnrollment: vi.fn(),
  createWorkshop: vi.fn(),
  errorMessage: (err, fallback) => err.response?.data?.message || fallback,
}));

import * as api from "../api/workshopApi";
import Workshops from "../pages/seeker/Workshops";
import CreateWorkshop, { to12Hour } from "../pages/facilitator/CreateWorkshop";

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

// ---------- seeker: Workshops page ----------

describe("Workshops page", () => {
  it("shows a loading message and then the workshops", async () => {
    api.getAvailableWorkshops.mockResolvedValue([workshop()]);
    render(<Workshops />);

    expect(screen.getByText("Loading workshops...")).toBeInTheDocument();
    expect(await screen.findByText("Exam Stress Workshop")).toBeInTheDocument();
    expect(screen.getByText(/with Test Facilitator/)).toBeInTheDocument();
    expect(screen.getByText(/Seats left: 3 of 5/)).toBeInTheDocument();
  });

  it("shows a message when there are no workshops", async () => {
    api.getAvailableWorkshops.mockResolvedValue([]);
    render(<Workshops />);

    expect(await screen.findByText(/No workshops are open right now/)).toBeInTheDocument();
  });

  it("shows the server's message when loading fails", async () => {
    api.getAvailableWorkshops.mockRejectedValue({
      response: { data: { message: "Your account is not approved yet." } },
    });
    render(<Workshops />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Your account is not approved yet.");
  });

  it("shows a fallback message when loading fails without a reply", async () => {
    api.getAvailableWorkshops.mockRejectedValue(new Error("network down"));
    render(<Workshops />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load workshops.");
  });

  it("enrolls a seeker and switches to the enrolled state", async () => {
    const user = userEvent.setup();
    api.getAvailableWorkshops.mockResolvedValue([workshop()]);
    api.enrollInWorkshop.mockResolvedValue({ message: "Enrolled" });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: "Enroll" }));

    expect(api.enrollInWorkshop).toHaveBeenCalledWith("w1");
    expect(await screen.findByText("You are enrolled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel enrollment" })).toBeInTheDocument();
  });

  it("shows a disabled Full button for a full workshop", async () => {
    api.getAvailableWorkshops.mockResolvedValue([
      workshop({ _id: "w1", title: "Full workshop", isFull: true, seatsAvailable: 0 }),
      workshop({ _id: "w2", title: "Open workshop" }),
    ]);
    render(<Workshops />);

    const full = await screen.findByRole("button", { name: "Full" });
    expect(full).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enroll" })).toBeEnabled();
  });

  it("shows the enrolled state for a workshop the seeker already joined", async () => {
    api.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: true })]);
    render(<Workshops />);

    expect(await screen.findByText("You are enrolled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
  });

  it("treats a 409 'already enrolled' reply as enrolled", async () => {
    const user = userEvent.setup();
    api.getAvailableWorkshops.mockResolvedValue([workshop()]);
    api.enrollInWorkshop.mockRejectedValue({
      response: { status: 409, data: { message: "You are already enrolled" } },
    });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: "Enroll" }));

    expect(await screen.findByText("You are already enrolled")).toBeInTheDocument();
    expect(screen.getByText("You are enrolled")).toBeInTheDocument();
  });

  it("shows the message and keeps the Enroll button when the workshop turns out full", async () => {
    const user = userEvent.setup();
    api.getAvailableWorkshops.mockResolvedValue([workshop()]);
    api.enrollInWorkshop.mockRejectedValue({
      response: { status: 409, data: { message: "Workshop is full" } },
    });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: "Enroll" }));

    expect(await screen.findByText("Workshop is full")).toBeInTheDocument();
    expect(screen.queryByText("You are enrolled")).not.toBeInTheDocument();
  });

  it("cancels an enrollment and shows Enroll again", async () => {
    const user = userEvent.setup();
    api.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: true })]);
    api.cancelEnrollment.mockImplementation(async () => {
      // after the cancel, the server reports the workshop as not joined
      api.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: false })]);
      return { message: "Enrollment cancelled" };
    });
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: "Cancel enrollment" }));

    expect(api.cancelEnrollment).toHaveBeenCalledWith("w1");
    expect(await screen.findByRole("button", { name: "Enroll" })).toBeInTheDocument();
    expect(screen.queryByText("You are enrolled")).not.toBeInTheDocument();
  });
});

// ---------- facilitator: Create Workshop form ----------

describe("to12Hour", () => {
  it("converts 24-hour times to the 12-hour format the server expects", () => {
    expect(to12Hour("14:30")).toBe("02:30 PM");
    expect(to12Hour("09:15")).toBe("09:15 AM");
    expect(to12Hour("00:05")).toBe("12:05 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("")).toBe("");
  });
});

describe("CreateWorkshop form", () => {
  const fillForm = async (user) => {
    await user.type(screen.getByLabelText("Title"), "Coping With Exam Anxiety");
    await user.type(
      screen.getByLabelText("Description"),
      "A practical session on calming techniques before exams."
    );
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "14:30" } });
    await user.type(screen.getByLabelText("Meeting link or address"), "https://meet.example.com/x");
  };

  it("shows all the fields and the submit button", () => {
    render(<CreateWorkshop />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByLabelText("Duration (minutes)")).toBeInTheDocument();
    expect(screen.getByLabelText("Seats")).toBeInTheDocument();
    expect(screen.getByLabelText("Mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting link or address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workshop" })).toBeInTheDocument();
  });

  it("asks for a title before sending anything", async () => {
    const user = userEvent.setup();
    render(<CreateWorkshop />);

    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a workshop title.");
    expect(api.createWorkshop).not.toHaveBeenCalled();
  });

  it("asks for a date when only the title is filled", async () => {
    const user = userEvent.setup();
    render(<CreateWorkshop />);

    await user.type(screen.getByLabelText("Title"), "Coping With Exam Anxiety");
    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a date.");
    expect(api.createWorkshop).not.toHaveBeenCalled();
  });

  it("sends the workshop in the format the server expects", async () => {
    const user = userEvent.setup();
    api.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(api.createWorkshop).toHaveBeenCalledWith({
      title: "Coping With Exam Anxiety",
      description: "A practical session on calming techniques before exams.",
      date: "2099-01-01",
      time: "02:30 PM",
      durationMinutes: 60,
      mode: "Online",
      locationOrLink: "https://meet.example.com/x",
      capacity: 20,
    });
  });

  it("shows a success message and clears the form after saving", async () => {
    const user = userEvent.setup();
    api.createWorkshop.mockResolvedValue({ message: "Workshop created" });
    render(<CreateWorkshop />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Workshop created.");
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("shows the server's error message and keeps what was typed", async () => {
    const user = userEvent.setup();
    api.createWorkshop.mockRejectedValue({
      response: { data: { message: "Workshop date cannot be in the past" } },
    });
    render(<CreateWorkshop />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Workshop date cannot be in the past");
    expect(screen.getByLabelText("Title")).toHaveValue("Coping With Exam Anxiety");
  });

  it("shows a fallback message when the server does not answer", async () => {
    const user = userEvent.setup();
    api.createWorkshop.mockRejectedValue(new Error("network down"));
    render(<CreateWorkshop />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create workshop" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create the workshop. Try again.");
  });
});