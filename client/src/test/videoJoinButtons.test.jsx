// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

// T18.11 - the Join video consultation button on the psychologist case page.
// T18.12 - the same button on the seeker's request card.
//
// Both sides of a consultation must reach the SAME room, and only once the
// case is accepted. These drive the two real pages rather than the button on
// its own, because the condition that decides whether it appears lives there.

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

vi.mock("../api/psychologistApi", () => ({
  getCaseDetailsById: vi.fn(),
  getCasePrivateNotes: vi.fn(),
  addCasePrivateNote: vi.fn(),
  updateCaseStatus: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../components/chat/ChatWindow", () => ({
  default: () => <div data-testid="chat-window" />,
}));

import axios from "axios";
import * as videoApi from "../api/videoApi";
import * as psychologistApi from "../api/psychologistApi";
import CaseDetailPage from "../pages/psychologist/CaseDetailPage";
import SeekerDashboard from "../pages/seeker/SeekerDashboard";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("token", "test-token");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const consultationRoom = (overrides = {}) => ({
  roomName: "mindease-case-c1-0628d913ca",
  domain: "meet.jit.si",
  url: "https://meet.jit.si/mindease-case-c1-0628d913ca",
  displayName: "Test Psychologist",
  subject: "MindEase consultation",
  isModerator: true,
  case: { id: "c1" },
  ...overrides,
});

// ---------- T18.11: the psychologist case page ----------

const renderCasePage = (caseDoc) => {
  psychologistApi.getCaseDetailsById.mockResolvedValue({
    success: true,
    data: { case: caseDoc },
  });
  psychologistApi.getCasePrivateNotes.mockResolvedValue({ success: true, data: [] });

  return render(
    <MemoryRouter initialEntries={["/dashboard/psychologist/cases/c1"]}>
      <Routes>
        <Route path="/dashboard/psychologist/cases/:caseId" element={<CaseDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

const caseDoc = (overrides = {}) => ({
  _id: "c1",
  status: "accepted",
  summary: "Handover summary from the volunteer.",
  request: { _id: "r1", description: "A description of the situation." },
  ...overrides,
});

describe("Psychologist case page: Join video consultation (T18.11)", () => {
  it("offers the button on an accepted case", async () => {
    renderCasePage(caseDoc());
    expect(
      await screen.findByRole("button", { name: /video consultation/i })
    ).toBeInTheDocument();
  });

  it.each(["pending", "rejected", "completed"])(
    "does not offer it on a %s case",
    async (status) => {
      renderCasePage(caseDoc({ status }));
      await waitFor(() => expect(psychologistApi.getCaseDetailsById).toHaveBeenCalled());
      expect(
        screen.queryByRole("button", { name: /video consultation/i })
      ).not.toBeInTheDocument();
    }
  );

  it("says Start, because the psychologist is the moderator", async () => {
    const user = userEvent.setup();
    videoApi.getCaseRoom.mockResolvedValue(consultationRoom({ isModerator: true }));
    renderCasePage(caseDoc());

    await user.click(await screen.findByRole("button", { name: /join video consultation/i }));

    expect(
      await screen.findByRole("button", { name: /start video consultation/i })
    ).toBeInTheDocument();
  });

  it("opens the room for the case id", async () => {
    const user = userEvent.setup();
    videoApi.getCaseRoom.mockResolvedValue(consultationRoom());
    renderCasePage(caseDoc());

    await user.click(await screen.findByRole("button", { name: /video consultation/i }));

    await waitFor(() => expect(videoApi.getCaseRoom).toHaveBeenCalledWith("c1"));
    expect(videoApi.openRoom).toHaveBeenCalledWith(
      "https://meet.jit.si/mindease-case-c1-0628d913ca"
    );
  });

  it("shows the server's refusal rather than opening a tab", async () => {
    const user = userEvent.setup();
    videoApi.getCaseRoom.mockRejectedValue({
      response: { status: 403, data: { message: "You are not part of this case." } },
    });
    renderCasePage(caseDoc());

    await user.click(await screen.findByRole("button", { name: /video consultation/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not part of this case/i);
    expect(videoApi.openRoom).not.toHaveBeenCalled();
  });

  it("works when the API returns a flat case instead of { case }", async () => {
    // the page was written against one shape and the API answers another;
    // the button normalises both (see the comment in CaseDetailPage)
    psychologistApi.getCaseDetailsById.mockResolvedValue({
      success: true,
      data: caseDoc(),
    });
    psychologistApi.getCasePrivateNotes.mockResolvedValue({ success: true, data: [] });

    render(
      <MemoryRouter initialEntries={["/dashboard/psychologist/cases/c1"]}>
        <Routes>
          <Route path="/dashboard/psychologist/cases/:caseId" element={<CaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("button", { name: /video consultation/i })
    ).toBeInTheDocument();
  });
});

// ---------- T18.12: the seeker request card ----------

const renderSeekerDashboard = (requests) => {
  axios.get.mockResolvedValue({ data: { requests } });
  return render(
    <MemoryRouter>
      <SeekerDashboard />
    </MemoryRouter>
  );
};

const request = (overrides = {}) => ({
  _id: "r1",
  description: "I have been struggling with exam pressure.",
  status: "escalated",
  urgency: "high",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("Seeker request card: Join video consultation (T18.12)", () => {
  it("offers the button once the request has been escalated", async () => {
    renderSeekerDashboard([request()]);
    expect(
      await screen.findByRole("button", { name: /join video consultation/i })
    ).toBeInTheDocument();
  });

  it.each(["pending", "accepted", "closed"])(
    "does not offer it while the request is %s",
    async (status) => {
      renderSeekerDashboard([request({ status })]);
      await screen.findByText(/struggling with exam pressure/i);
      expect(
        screen.queryByRole("button", { name: /join video consultation/i })
      ).not.toBeInTheDocument();
    }
  );

  it("looks the room up by the REQUEST id, which is all the seeker has", async () => {
    const user = userEvent.setup();
    videoApi.getRequestRoom.mockResolvedValue(consultationRoom({ isModerator: false }));
    renderSeekerDashboard([request()]);

    await user.click(await screen.findByRole("button", { name: /join video consultation/i }));

    await waitFor(() => expect(videoApi.getRequestRoom).toHaveBeenCalledWith("r1"));
    expect(videoApi.getCaseRoom).not.toHaveBeenCalled();
  });

  it("lands in the same room the psychologist gets", async () => {
    const user = userEvent.setup();
    videoApi.getRequestRoom.mockResolvedValue(consultationRoom({ isModerator: false }));
    renderSeekerDashboard([request()]);

    await user.click(await screen.findByRole("button", { name: /join video consultation/i }));

    await waitFor(() =>
      expect(videoApi.openRoom).toHaveBeenCalledWith(
        "https://meet.jit.si/mindease-case-c1-0628d913ca"
      )
    );
  });

  it("explains it plainly when the psychologist has not accepted yet", async () => {
    const user = userEvent.setup();
    videoApi.getRequestRoom.mockRejectedValue({
      response: {
        status: 404,
        data: { message: "There is no accepted consultation for this request yet." },
      },
    });
    renderSeekerDashboard([request()]);

    await user.click(await screen.findByRole("button", { name: /join video consultation/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no accepted consultation/i);
    expect(videoApi.openRoom).not.toHaveBeenCalled();
  });

  it("stays as Join for the seeker, who is not the moderator", async () => {
    const user = userEvent.setup();
    videoApi.getRequestRoom.mockResolvedValue(consultationRoom({ isModerator: false }));
    renderSeekerDashboard([request()]);

    await user.click(await screen.findByRole("button", { name: /join video consultation/i }));

    await waitFor(() => expect(videoApi.openRoom).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /join video consultation/i })
    ).toBeInTheDocument();
  });
});
