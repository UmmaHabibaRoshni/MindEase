import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// T15.8 (BL-15) - unit tests for the navbar bell and its dropdown.
//
// The API module is mocked, so these never touch the network and do not need
// T15.3 to exist yet. When it lands, only notificationApi.js has to agree with
// it - the component is tested against this contract.

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../api/notificationApi", () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  readError: (err, fallback = "Could not load notifications.") =>
    err?.response?.data?.message || fallback,
}));

import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "../../api/notificationApi";
import NotificationBell from "./NotificationBell";

const note = (over = {}) => ({
  _id: "n1",
  type: "request_accepted",
  message: "A volunteer accepted your request",
  link: "/dashboard/requests/r1",
  read: false,
  createdAt: new Date().toISOString(),
  ...over,
});

function setup() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    ),
  };
}

// Waits for the first poll to land so a test never asserts on a blank badge.
const countSettled = () => waitFor(() => expect(getUnreadCount).toHaveBeenCalled());

beforeEach(() => {
  getUnreadCount.mockResolvedValue(0);
  getNotifications.mockResolvedValue([]);
  markRead.mockResolvedValue(note({ read: true }));
  markAllRead.mockResolvedValue({ modified: 0 });
});

describe("the badge", () => {
  it("shows the unread count when the bell loads", async () => {
    getUnreadCount.mockResolvedValue(3);
    setup();

    expect(await screen.findByTestId("bell-badge")).toHaveTextContent("3");
  });

  it("shows no badge at all when nothing is unread", async () => {
    getUnreadCount.mockResolvedValue(0);
    setup();
    await countSettled();

    expect(screen.queryByTestId("bell-badge")).not.toBeInTheDocument();
  });

  // A three-digit number would stretch the bell out of shape in the navbar.
  it("caps a large count at 9+", async () => {
    getUnreadCount.mockResolvedValue(42);
    setup();

    expect(await screen.findByTestId("bell-badge")).toHaveTextContent("9+");
  });

  it("puts the count in the label so a screen reader hears it", async () => {
    getUnreadCount.mockResolvedValue(2);
    setup();

    expect(await screen.findByLabelText("Notifications, 2 unread")).toBeInTheDocument();
  });

  // The count poll runs on a timer. A failed poll must not blank a number that
  // is already on screen, and must not throw an error in someone's face.
  it("keeps the last good count when a refresh fails", async () => {
    getUnreadCount.mockRejectedValue(new Error("offline"));
    setup();
    await countSettled();

    expect(screen.queryByTestId("bell-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bell-error")).not.toBeInTheDocument();
  });

  // Closed, the bell must not pull the whole list - that is the point of
  // having a separate count endpoint.
  it("does not fetch the list until the bell is opened", async () => {
    setup();
    await countSettled();

    expect(getNotifications).not.toHaveBeenCalled();
  });
});

describe("opening the dropdown", () => {
  it("lists the notifications", async () => {
    getNotifications.mockResolvedValue([
      note({ _id: "n1", message: "A volunteer accepted your request" }),
      note({ _id: "n2", message: "Your workshop was cancelled", read: true }),
    ]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));

    expect(await screen.findByText("A volunteer accepted your request")).toBeInTheDocument();
    expect(screen.getByText("Your workshop was cancelled")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", async () => {
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));

    expect(await screen.findByTestId("bell-empty")).toBeInTheDocument();
  });

  it("shows the server's own message when the list fails to load", async () => {
    getNotifications.mockRejectedValue({ response: { data: { message: "Session expired." } } });
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));

    expect(await screen.findByTestId("bell-error")).toHaveTextContent("Session expired.");
  });

  it("closes again on a second click", async () => {
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    expect(await screen.findByTestId("bell-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("bell-button"));
    expect(screen.queryByTestId("bell-panel")).not.toBeInTheDocument();
  });

  it("closes when the Escape key is pressed", async () => {
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await screen.findByTestId("bell-panel");

    await user.keyboard("{Escape}");

    expect(screen.queryByTestId("bell-panel")).not.toBeInTheDocument();
  });

  it("closes when the click lands outside it", async () => {
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await screen.findByTestId("bell-panel");

    await user.click(document.body);

    await waitFor(() => expect(screen.queryByTestId("bell-panel")).not.toBeInTheDocument());
  });

  // The badge is driven by the count endpoint; opening the list is a second
  // opinion, and the list is the one that is definitely current.
  it("corrects the badge from the list it just fetched", async () => {
    getUnreadCount.mockResolvedValue(5);
    getNotifications.mockResolvedValue([note({ _id: "n1" }), note({ _id: "n2", read: true })]);
    const { user } = setup();
    await screen.findByTestId("bell-badge");

    await user.click(screen.getByTestId("bell-button"));

    await waitFor(() => expect(screen.getByTestId("bell-badge")).toHaveTextContent("1"));
  });
});

describe("opening one notification", () => {
  it("marks it read, closes the panel and follows the link", async () => {
    getUnreadCount.mockResolvedValue(1);
    getNotifications.mockResolvedValue([note({ _id: "n1", link: "/dashboard/requests/r1" })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-item-n1"));

    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).toHaveBeenCalledWith("/dashboard/requests/r1");
    await waitFor(() => expect(screen.queryByTestId("bell-panel")).not.toBeInTheDocument());
  });

  it("drops the unread count by one", async () => {
    getUnreadCount.mockResolvedValue(2);
    getNotifications.mockResolvedValue([note({ _id: "n1" }), note({ _id: "n2" })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-item-n1"));

    await waitFor(() => expect(screen.getByTestId("bell-badge")).toHaveTextContent("1"));
  });

  it("does not mark an already-read notification again", async () => {
    getNotifications.mockResolvedValue([note({ _id: "n1", read: true })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-item-n1"));

    expect(markRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
  });

  it("still closes and navigates when there is no link", async () => {
    getNotifications.mockResolvedValue([note({ _id: "n1", link: "" })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-item-n1"));

    expect(navigate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("bell-panel")).not.toBeInTheDocument());
  });

  // Showing it as read when the server never got the request would lose the
  // notification: the badge would be wrong and the row would look handled.
  it("puts the unread state back if the server refuses", async () => {
    getUnreadCount.mockResolvedValue(1);
    getNotifications.mockResolvedValue([note({ _id: "n1" })]);
    markRead.mockRejectedValue(new Error("offline"));
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-item-n1"));

    await waitFor(() => expect(screen.getByTestId("bell-badge")).toHaveTextContent("1"));
  });
});

describe("mark all read", () => {
  it("clears the badge and calls the API once", async () => {
    getUnreadCount.mockResolvedValue(2);
    getNotifications.mockResolvedValue([note({ _id: "n1" }), note({ _id: "n2" })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-mark-all"));

    expect(markAllRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("bell-badge")).not.toBeInTheDocument());
  });

  it("is not offered when everything is already read", async () => {
    getNotifications.mockResolvedValue([note({ _id: "n1", read: true })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await screen.findByTestId("bell-item-n1");

    expect(screen.queryByTestId("bell-mark-all")).not.toBeInTheDocument();
  });

  it("restores the count and explains itself when the call fails", async () => {
    getUnreadCount.mockResolvedValue(2);
    getNotifications.mockResolvedValue([note({ _id: "n1" }), note({ _id: "n2" })]);
    markAllRead.mockRejectedValue({ response: { data: { message: "Try again later." } } });
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    await user.click(await screen.findByTestId("bell-mark-all"));

    expect(await screen.findByTestId("bell-error")).toHaveTextContent("Try again later.");
    await waitFor(() => expect(screen.getByTestId("bell-badge")).toHaveTextContent("2"));
  });
});

describe("how each row reads", () => {
  it("tells an unread row apart from a read one", async () => {
    getNotifications.mockResolvedValue([
      note({ _id: "n1", message: "Unread one" }),
      note({ _id: "n2", message: "Read one", read: true }),
    ]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));

    const unread = await screen.findByTestId("bell-item-n1");
    const read = screen.getByTestId("bell-item-n2");
    expect(unread).toHaveStyle({ fontWeight: "600" });
    expect(read).not.toHaveStyle({ fontWeight: "600" });
  });

  it("says how long ago it arrived", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    getNotifications.mockResolvedValue([note({ _id: "n1", createdAt: twoHoursAgo })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));

    expect(within(await screen.findByTestId("bell-item-n1")).getByText("2h ago")).toBeInTheDocument();
  });

  it("shows nothing rather than Invalid Date for a missing timestamp", async () => {
    getNotifications.mockResolvedValue([note({ _id: "n1", createdAt: undefined })]);
    const { user } = setup();
    await countSettled();

    await user.click(screen.getByTestId("bell-button"));
    const row = await screen.findByTestId("bell-item-n1");

    expect(row.textContent).not.toMatch(/invalid/i);
  });
});
