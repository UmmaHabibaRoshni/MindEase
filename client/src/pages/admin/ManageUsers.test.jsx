import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// T16.10 (BL-16) - unit tests for the admin ManageUsers page.
//
// adminApi is mocked, so these do not need T16.5 to exist yet. When it lands,
// only adminApi.js has to agree with it.

vi.mock("../../api/adminApi", () => ({
  getUsers: vi.fn(),
  suspendUser: vi.fn(),
  reactivateUser: vi.fn(),
  readError: (err, fallback = "Something went wrong.") =>
    err?.response?.data?.message || fallback,
}));

import { getUsers, reactivateUser, suspendUser } from "../../api/adminApi";
import ManageUsers from "./ManageUsers";

const user = (over = {}) => ({
  _id: "u1",
  name: "Rafi Ahmed",
  email: "rafi@test.com",
  role: "volunteer",
  status: "approved",
  createdAt: "2026-10-01T10:00:00.000Z",
  ...over,
});

const setup = () => ({ user: userEvent.setup(), ...render(<ManageUsers />) });

const listed = () => waitFor(() => expect(getUsers).toHaveBeenCalled());

beforeEach(() => {
  getUsers.mockResolvedValue([user()]);
  suspendUser.mockResolvedValue(user({ status: "suspended" }));
  reactivateUser.mockResolvedValue(user({ status: "approved" }));
});

describe("the list", () => {
  it("shows each user with their role and status", async () => {
    getUsers.mockResolvedValue([
      user({ _id: "u1", name: "Rafi Ahmed", role: "volunteer", status: "approved" }),
      user({ _id: "u2", name: "Mim Akter", email: "mim@test.com", role: "ngo", status: "pending" }),
    ]);
    setup();

    const row = await screen.findByTestId("users-row-u1");
    expect(within(row).getByText("Rafi Ahmed")).toBeInTheDocument();
    expect(within(row).getByText("volunteer")).toBeInTheDocument();
    expect(within(row).getByText("approved")).toBeInTheDocument();
    expect(within(screen.getByTestId("users-row-u2")).getByText("Mim Akter")).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    getUsers.mockResolvedValue([]);
    setup();

    expect(await screen.findByTestId("users-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("users-table")).not.toBeInTheDocument();
  });

  it("shows the server's own message when the list fails", async () => {
    getUsers.mockRejectedValue({ response: { data: { message: "Session expired." } } });
    setup();

    expect(await screen.findByTestId("users-error")).toHaveTextContent("Session expired.");
  });

  it("shows a loading line first", async () => {
    setup();

    expect(screen.getByTestId("users-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("users-loading")).not.toBeInTheDocument());
  });

  it("shows a dash rather than Invalid Date when the join date is missing", async () => {
    getUsers.mockResolvedValue([user({ createdAt: null })]);
    setup();

    const row = await screen.findByTestId("users-row-u1");
    expect(within(row).getByText("-")).toBeInTheDocument();
  });
});

describe("the filters", () => {
  it("asks for nothing extra on the first load", async () => {
    setup();
    await listed();

    expect(getUsers).toHaveBeenCalledWith({ role: "", status: "", q: "" });
  });

  it("filters by role", async () => {
    const { user: ui } = setup();
    await listed();

    await ui.selectOptions(screen.getByTestId("users-role"), "psychologist");

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({ role: "psychologist", status: "", q: "" })
    );
  });

  it("filters by status", async () => {
    const { user: ui } = setup();
    await listed();

    await ui.selectOptions(screen.getByTestId("users-status"), "suspended");

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({ role: "", status: "suspended", q: "" })
    );
  });

  it("combines a role and a status", async () => {
    const { user: ui } = setup();
    await listed();

    await ui.selectOptions(screen.getByTestId("users-role"), "ngo");
    await ui.selectOptions(screen.getByTestId("users-status"), "pending");

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({ role: "ngo", status: "pending", q: "" })
    );
  });

  it("searches by name or email", async () => {
    const { user: ui } = setup();
    await listed();

    await ui.type(screen.getByTestId("users-search"), "rafi");

    await waitFor(() => expect(getUsers).toHaveBeenLastCalledWith({ role: "", status: "", q: "rafi" }));
  });

  // 'suspended' only exists on the model once T16.1 lands, but the admin needs
  // to be able to filter for it the moment it does.
  it("offers suspended as a status to filter by", async () => {
    setup();
    await listed();

    const options = within(screen.getByTestId("users-status"))
      .getAllByRole("option")
      .map((o) => o.value);
    expect(options).toContain("suspended");
  });

  it("offers every role the system has", async () => {
    setup();
    await listed();

    const options = within(screen.getByTestId("users-role"))
      .getAllByRole("option")
      .map((o) => o.value);
    expect(options).toEqual(
      expect.arrayContaining(["seeker", "volunteer", "psychologist", "ngo", "facilitator", "admin"])
    );
  });
});

describe("suspending someone", () => {
  it("asks for a reason before it will do it", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));

    expect(screen.getByTestId("users-reason-u1")).toBeInTheDocument();
    expect(screen.getByTestId("users-confirm-u1")).toBeDisabled();
    expect(suspendUser).not.toHaveBeenCalled();
  });

  it("sends the reason and reports it worked", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Repeated abuse reports");
    await ui.click(screen.getByTestId("users-confirm-u1"));

    expect(suspendUser).toHaveBeenCalledWith("u1", "Repeated abuse reports");
    expect(await screen.findByTestId("users-notice")).toHaveTextContent("Rafi Ahmed is suspended.");
  });

  it("updates the row in place instead of reloading the whole list", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");
    const callsBefore = getUsers.mock.calls.length;

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Spam");
    await ui.click(screen.getByTestId("users-confirm-u1"));

    const row = await screen.findByTestId("users-row-u1");
    await waitFor(() => expect(within(row).getByText("suspended")).toBeInTheDocument());
    expect(getUsers.mock.calls).toHaveLength(callsBefore);
  });

  it("offers Reactivate once the account is suspended", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Spam");
    await ui.click(screen.getByTestId("users-confirm-u1"));

    expect(await screen.findByTestId("users-reactivate-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("users-suspend-u1")).not.toBeInTheDocument();
  });

  it("can be called off without touching the account", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Changed my mind");
    await ui.click(screen.getByTestId("users-cancel-u1"));

    expect(suspendUser).not.toHaveBeenCalled();
    expect(screen.getByTestId("users-suspend-u1")).toBeInTheDocument();
  });

  // If the reason survived a cancel, the next admin to open the box would see
  // somebody else's half-typed note already in it.
  it("forgets the typed reason after a cancel", async () => {
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Draft text");
    await ui.click(screen.getByTestId("users-cancel-u1"));
    await ui.click(screen.getByTestId("users-suspend-u1"));

    expect(screen.getByTestId("users-reason-u1")).toHaveValue("");
  });

  it("explains itself and leaves the row alone when the server refuses", async () => {
    suspendUser.mockRejectedValue({ response: { data: { message: "Cannot suspend an admin." } } });
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Testing");
    await ui.click(screen.getByTestId("users-confirm-u1"));

    expect(await screen.findByTestId("users-error")).toHaveTextContent("Cannot suspend an admin.");
    const row = screen.getByTestId("users-row-u1");
    expect(within(row).getByText("approved")).toBeInTheDocument();
  });
});

describe("reactivating someone", () => {
  it("calls the API and reports it worked", async () => {
    getUsers.mockResolvedValue([user({ status: "suspended" })]);
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-reactivate-u1"));

    expect(reactivateUser).toHaveBeenCalledWith("u1");
    expect(await screen.findByTestId("users-notice")).toHaveTextContent("Rafi Ahmed is active again.");
  });

  it("needs no reason", async () => {
    getUsers.mockResolvedValue([user({ status: "suspended" })]);
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-reactivate-u1"));

    expect(screen.queryByTestId("users-reason-u1")).not.toBeInTheDocument();
  });

  it("puts the row back to approved", async () => {
    getUsers.mockResolvedValue([user({ status: "suspended" })]);
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-reactivate-u1"));

    const row = await screen.findByTestId("users-row-u1");
    await waitFor(() => expect(within(row).getByText("approved")).toBeInTheDocument());
  });
});

describe("guard rails", () => {
  // Suspending yourself could lock the last admin out of the whole system.
  it("offers no suspend button on the admin's own row", async () => {
    getUsers.mockResolvedValue([user({ _id: "me", name: "Ahnaf", role: "admin", isSelf: true })]);
    setup();

    await screen.findByTestId("users-row-me");
    expect(screen.queryByTestId("users-suspend-me")).not.toBeInTheDocument();
    expect(screen.getByText("This is you")).toBeInTheDocument();
  });

  it("locks only the row being changed, not the whole table", async () => {
    getUsers.mockResolvedValue([user({ _id: "u1" }), user({ _id: "u2", name: "Mim Akter" })]);
    let release;
    suspendUser.mockReturnValue(new Promise((resolve) => {
      release = () => resolve(user({ status: "suspended" }));
    }));
    const { user: ui } = setup();
    await screen.findByTestId("users-row-u1");

    await ui.click(screen.getByTestId("users-suspend-u1"));
    await ui.type(screen.getByTestId("users-reason-u1"), "Spam");
    await ui.click(screen.getByTestId("users-confirm-u1"));

    expect(screen.getByTestId("users-confirm-u1")).toBeDisabled();
    expect(screen.getByTestId("users-suspend-u2")).not.toBeDisabled();

    release();
  });
});
