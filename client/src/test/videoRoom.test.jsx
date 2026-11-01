// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// T18.10 - the VideoRoom page and the Join video session button on a seeker's
// workshop card. The API helper is mocked, so no server and no real tab opens.
//
// The T18.1 spike chose a new tab over an embed, so these assert that the room
// is OPENED, never that an iframe renders.

vi.mock("../api/videoApi", async () => {
  const getWorkshopRoom = vi.fn();
  const getCaseRoom = vi.fn();
  const getRequestRoom = vi.fn();
  return {
    getWorkshopRoom,
    getCaseRoom,
    getRequestRoom,
    openRoom: vi.fn(),
    errorMessage: (err, fallback) => err.response?.data?.message || fallback,
    roomLoaders: { workshop: getWorkshopRoom, case: getCaseRoom, request: getRequestRoom },
  };
});

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

import * as videoApi from "../api/videoApi";
import * as workshopApi from "../api/workshopApi";
import { VideoRoomView } from "../components/video/VideoRoom";
import JoinVideoButton from "../components/video/JoinVideoButton";
import Workshops from "../pages/seeker/Workshops";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const room = (overrides = {}) => ({
  roomName: "mindease-workshop-w1-3a9c1b7e05",
  domain: "meet.jit.si",
  url: "https://meet.jit.si/mindease-workshop-w1-3a9c1b7e05",
  displayName: "Test Seeker",
  subject: "Managing exam stress",
  isModerator: false,
  ...overrides,
});

const refusal = (status, message) => ({ response: { status, data: { message } } });

// ---------- the VideoRoom page ----------

describe("VideoRoom page", () => {
  it("shows a loading line and then the room subject", async () => {
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(screen.getByText(/loading the video room/i)).toBeInTheDocument();
    expect(await screen.findByText("Managing exam stress")).toBeInTheDocument();
  });

  it("offers Join, not Start, to someone who is not the moderator", async () => {
    videoApi.getWorkshopRoom.mockResolvedValue(room({ isModerator: false }));
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByRole("button", { name: /join video session/i })).toBeInTheDocument();
  });

  it("offers Start to the moderator and says they are expected to open it", async () => {
    videoApi.getWorkshopRoom.mockResolvedValue(room({ isModerator: true }));
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByRole("button", { name: /start video session/i })).toBeInTheDocument();
    expect(screen.getByText(/you are expected to open this call/i)).toBeInTheDocument();
  });

  it("opens the room URL in a new tab rather than embedding it", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    const { container } = render(<VideoRoomView kind="workshop" id="w1" />);

    await user.click(await screen.findByRole("button", { name: /join video session/i }));

    expect(videoApi.openRoom).toHaveBeenCalledWith(
      "https://meet.jit.si/mindease-workshop-w1-3a9c1b7e05"
    );
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("shows the domain and the room name, and gives a fallback link", async () => {
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByText("meet.jit.si")).toBeInTheDocument();
    expect(screen.getByText("mindease-workshop-w1-3a9c1b7e05")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the room directly/i })).toHaveAttribute(
      "href",
      "https://meet.jit.si/mindease-workshop-w1-3a9c1b7e05"
    );
  });

  it("warns that anyone with the room name can enter", async () => {
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByText(/anyone who knows this room name/i)).toBeInTheDocument();
  });

  it("shows the server's refusal instead of a room", async () => {
    videoApi.getWorkshopRoom.mockRejectedValue(
      refusal(403, "You are not part of this workshop.")
    );
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/not part of this workshop/i);
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });

  it("explains a cancelled workshop in the server's own words", async () => {
    videoApi.getWorkshopRoom.mockRejectedValue(
      refusal(400, "This workshop has been cancelled.")
    );
    render(<VideoRoomView kind="workshop" id="w1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled/i);
  });

  it("uses the case loader when the kind is case", async () => {
    videoApi.getCaseRoom.mockResolvedValue(room({ subject: "MindEase consultation" }));
    render(<VideoRoomView kind="case" id="c1" />);

    expect(await screen.findByText("MindEase consultation")).toBeInTheDocument();
    expect(videoApi.getCaseRoom).toHaveBeenCalledWith("c1");
    expect(videoApi.getWorkshopRoom).not.toHaveBeenCalled();
  });

  it("uses the request loader when the kind is request", async () => {
    videoApi.getRequestRoom.mockResolvedValue(room({ subject: "MindEase consultation" }));
    render(<VideoRoomView kind="request" id="r1" />);

    await waitFor(() => expect(videoApi.getRequestRoom).toHaveBeenCalledWith("r1"));
  });

  it("refuses a kind it does not know, without calling anything", async () => {
    render(<VideoRoomView kind="banana" id="x" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported/i);
    expect(videoApi.getWorkshopRoom).not.toHaveBeenCalled();
  });
});

// ---------- the Join button on its own ----------

describe("JoinVideoButton", () => {
  it("asks the server only when it is clicked", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<JoinVideoButton kind="workshop" id="w1" />);

    expect(videoApi.getWorkshopRoom).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /join video session/i }));
    await waitFor(() => expect(videoApi.getWorkshopRoom).toHaveBeenCalledWith("w1"));
  });

  it("opens the room it was given", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<JoinVideoButton kind="workshop" id="w1" />);

    await user.click(screen.getByRole("button", { name: /join video session/i }));
    await waitFor(() =>
      expect(videoApi.openRoom).toHaveBeenCalledWith(
        "https://meet.jit.si/mindease-workshop-w1-3a9c1b7e05"
      )
    );
  });

  it("shows the refusal and does not open anything", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockRejectedValue(
      refusal(403, "You are not part of this workshop.")
    );
    render(<JoinVideoButton kind="workshop" id="w1" />);

    await user.click(screen.getByRole("button", { name: /join video session/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not part of this workshop/i);
    expect(videoApi.openRoom).not.toHaveBeenCalled();
  });

  it("copes with a response that has no URL", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockResolvedValue({ roomName: "x" });
    render(<JoinVideoButton kind="workshop" id="w1" />);

    await user.click(screen.getByRole("button", { name: /join video session/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/did not return a room link/i);
    expect(videoApi.openRoom).not.toHaveBeenCalled();
  });

  it("offers a fallback link once the room is known", async () => {
    const user = userEvent.setup();
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<JoinVideoButton kind="workshop" id="w1" />);

    await user.click(screen.getByRole("button", { name: /join video session/i }));

    expect(await screen.findByRole("link", { name: /open it here/i })).toHaveAttribute(
      "href",
      "https://meet.jit.si/mindease-workshop-w1-3a9c1b7e05"
    );
  });
});

// ---------- T18.7: the button on a seeker's workshop card ----------

const future = new Date(Date.now() + 10 * 864e5).toISOString();

const workshop = (overrides = {}) => ({
  _id: "w1",
  title: "Exam Stress Workshop",
  description: "A guided session on handling exam pressure.",
  date: future,
  time: "10:30 AM",
  durationMinutes: 60,
  mode: "Online",
  status: "Scheduled",
  capacity: 5,
  seatsAvailable: 3,
  isFull: false,
  facilitator: { name: "Test Facilitator" },
  ...overrides,
});

describe("Workshops page: Join video session (T18.7)", () => {
  it("offers the join button to an enrolled seeker on an online workshop", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: true })]);
    render(<Workshops />);

    expect(
      await screen.findByRole("button", { name: /join video session/i })
    ).toBeInTheDocument();
  });

  it("does not offer it to a seeker who has not enrolled", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop()]);
    render(<Workshops />);

    await screen.findByText("Exam Stress Workshop");
    expect(screen.queryByRole("button", { name: /join video session/i })).not.toBeInTheDocument();
  });

  it("does not offer it for an In-Person workshop", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([
      workshop({ isEnrolled: true, mode: "In-Person" }),
    ]);
    render(<Workshops />);

    await screen.findByText("Exam Stress Workshop");
    expect(screen.queryByRole("button", { name: /join video session/i })).not.toBeInTheDocument();
  });

  it("does not offer it for a cancelled workshop", async () => {
    workshopApi.getAvailableWorkshops.mockResolvedValue([
      workshop({ isEnrolled: true, status: "Cancelled" }),
    ]);
    render(<Workshops />);

    await screen.findByText("Exam Stress Workshop");
    expect(screen.queryByRole("button", { name: /join video session/i })).not.toBeInTheDocument();
  });

  it("opens the workshop room for that workshop id", async () => {
    const user = userEvent.setup();
    workshopApi.getAvailableWorkshops.mockResolvedValue([workshop({ isEnrolled: true })]);
    videoApi.getWorkshopRoom.mockResolvedValue(room());
    render(<Workshops />);

    await user.click(await screen.findByRole("button", { name: /join video session/i }));

    await waitFor(() => expect(videoApi.getWorkshopRoom).toHaveBeenCalledWith("w1"));
    expect(videoApi.openRoom).toHaveBeenCalled();
  });
});
