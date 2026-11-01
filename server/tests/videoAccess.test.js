const mongoose = require("mongoose");

// T18.4 - unit tests for the video access rules (utils/videoAccess.js).
//
// Same style as workshop.test.js: the models are mocked over a small in-memory
// store, so no database runs. The rules are the whole point of BL-18 - the
// Jitsi room itself is open to anyone who knows its name, so these checks are
// the only thing deciding who is told the name.
//
// Role filtering (facilitator / seeker / psychologist) also happens in the
// route middleware; these tests cover the per-record rules underneath it.

const mockStore = { workshops: [], enrollments: [], assignments: [] };

const mockSame = (a, b) => String(a) === String(b);

// A stand-in for a mongoose query: .select() and .populate() chain, and the
// object itself is awaitable. The stored documents already hold populated
// shapes, so .populate() is a no-op here.
const mockChain = (value) => {
  const q = {
    select: () => q,
    populate: () => q,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

jest.mock("../models/Workshop", () => ({
  findById: (id) =>
    mockChain(mockStore.workshops.find((w) => mockSame(w._id, id)) || null),
}));

jest.mock("../models/WorkshopEnrollment", () => ({
  findOne: (filter) =>
    mockChain(
      mockStore.enrollments.find(
        (e) =>
          mockSame(e.workshop, filter.workshop) &&
          mockSame(e.seeker, filter.seeker) &&
          (filter.status?.$in
            ? filter.status.$in.includes(e.status)
            : e.status === filter.status)
      ) || null
    ),
}));

jest.mock("../models/CaseAssignment", () => ({
  findById: (id) =>
    mockChain(mockStore.assignments.find((a) => mockSame(a._id, id)) || null),
  findOne: (filter) =>
    mockChain(
      mockStore.assignments.find(
        (a) =>
          mockSame(a.request?._id, filter.request) &&
          (filter.status === undefined || a.status === filter.status)
      ) || null
    ),
}));

const {
  workshopVideoAccess,
  caseVideoAccess,
  requestVideoAccess,
} = require("../utils/videoAccess");

const id = () => new mongoose.Types.ObjectId();

// stable ids reused across the suite
const FACILITATOR = id();
const OTHER_FACILITATOR = id();
const SEEKER = id();
const OTHER_SEEKER = id();
const PSYCHOLOGIST = id();
const OTHER_PSYCHOLOGIST = id();

const user = (role, userId) => ({ id: String(userId), role, status: "approved" });

const addWorkshop = (overrides = {}) => {
  const w = {
    _id: id(),
    title: "Managing exam stress",
    facilitator: FACILITATOR,
    mode: "Online",
    status: "Scheduled",
    ...overrides,
  };
  mockStore.workshops.push(w);
  return w;
};

const addEnrollment = (workshop, seeker, status = "Enrolled") => {
  const e = { _id: id(), workshop: workshop._id, seeker, status };
  mockStore.enrollments.push(e);
  return e;
};

const addAssignment = (overrides = {}) => {
  const a = {
    _id: id(),
    psychologist: PSYCHOLOGIST,
    request: { _id: id(), seeker: SEEKER },
    status: "accepted",
    ...overrides,
  };
  mockStore.assignments.push(a);
  return a;
};

beforeEach(() => {
  mockStore.workshops = [];
  mockStore.enrollments = [];
  mockStore.assignments = [];
});

// ---------- T18.2: workshop rooms ----------

describe("workshopVideoAccess", () => {
  it("refuses an id that is not an ObjectId", async () => {
    const res = await workshopVideoAccess(user("seeker", SEEKER), "not-an-id");
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.message).toMatch(/invalid workshop id/i);
  });

  it("answers 404 when the workshop does not exist", async () => {
    const res = await workshopVideoAccess(user("seeker", SEEKER), id());
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("lets the facilitator who owns the workshop in, as moderator", async () => {
    const w = addWorkshop();
    const res = await workshopVideoAccess(user("facilitator", FACILITATOR), w._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(true);
    expect(String(res.workshop._id)).toBe(String(w._id));
  });

  it("keeps out a facilitator who owns a different workshop", async () => {
    const w = addWorkshop();
    const res = await workshopVideoAccess(user("facilitator", OTHER_FACILITATOR), w._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("lets an enrolled seeker in, but not as moderator", async () => {
    const w = addWorkshop();
    addEnrollment(w, SEEKER);
    const res = await workshopVideoAccess(user("seeker", SEEKER), w._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(false);
  });

  it("lets a seeker who already attended back in", async () => {
    const w = addWorkshop();
    addEnrollment(w, SEEKER, "Attended");
    const res = await workshopVideoAccess(user("seeker", SEEKER), w._id);
    expect(res.ok).toBe(true);
  });

  it("keeps out a seeker who is not enrolled", async () => {
    const w = addWorkshop();
    const res = await workshopVideoAccess(user("seeker", SEEKER), w._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("keeps out a seeker whose enrollment was cancelled", async () => {
    const w = addWorkshop();
    addEnrollment(w, SEEKER, "Cancelled");
    const res = await workshopVideoAccess(user("seeker", SEEKER), w._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("does not let one seeker in on another seeker's enrollment", async () => {
    const w = addWorkshop();
    addEnrollment(w, OTHER_SEEKER);
    const res = await workshopVideoAccess(user("seeker", SEEKER), w._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an In-Person workshop", async () => {
    const w = addWorkshop({ mode: "In-Person" });
    const res = await workshopVideoAccess(user("facilitator", FACILITATOR), w._id);
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.message).toMatch(/not held online/i);
  });

  it("refuses a Hybrid workshop, which is the open question in the QA note", async () => {
    const w = addWorkshop({ mode: "Hybrid" });
    const res = await workshopVideoAccess(user("facilitator", FACILITATOR), w._id);
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a cancelled workshop even for its owner", async () => {
    const w = addWorkshop({ status: "Cancelled" });
    const res = await workshopVideoAccess(user("facilitator", FACILITATOR), w._id);
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.message).toMatch(/cancelled/i);
  });

  it("still allows a completed workshop, which the task wording permits", async () => {
    const w = addWorkshop({ status: "Completed" });
    const res = await workshopVideoAccess(user("facilitator", FACILITATOR), w._id);
    expect(res.ok).toBe(true);
  });

  it("checks the mode before the person, so an In-Person room is refused to everyone", async () => {
    const w = addWorkshop({ mode: "In-Person" });
    const res = await workshopVideoAccess(user("seeker", OTHER_SEEKER), w._id);
    expect(res.status).toBe(400);
  });
});

// ---------- T18.3: case rooms ----------

describe("caseVideoAccess", () => {
  it("refuses an id that is not an ObjectId", async () => {
    const res = await caseVideoAccess(user("psychologist", PSYCHOLOGIST), "nope");
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.message).toMatch(/invalid case id/i);
  });

  it("answers 404 when the case does not exist", async () => {
    const res = await caseVideoAccess(user("psychologist", PSYCHOLOGIST), id());
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("lets the assigned psychologist in, as moderator", async () => {
    const a = addAssignment();
    const res = await caseVideoAccess(user("psychologist", PSYCHOLOGIST), a._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(true);
  });

  it("lets the seeker on the case in, but not as moderator", async () => {
    const a = addAssignment();
    const res = await caseVideoAccess(user("seeker", SEEKER), a._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(false);
  });

  it("keeps out a psychologist the case is not assigned to", async () => {
    const a = addAssignment();
    const res = await caseVideoAccess(user("psychologist", OTHER_PSYCHOLOGIST), a._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("keeps out a seeker who is not on the case", async () => {
    const a = addAssignment();
    const res = await caseVideoAccess(user("seeker", OTHER_SEEKER), a._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it.each(["pending", "rejected", "completed"])(
    "refuses a %s case, even for the assigned psychologist",
    async (status) => {
      const a = addAssignment({ status });
      const res = await caseVideoAccess(user("psychologist", PSYCHOLOGIST), a._id);
      expect(res).toMatchObject({ ok: false, status: 400 });
      expect(res.message).toMatch(/not accepted/i);
    }
  );

  it("checks the status before the person, so a stranger learns nothing extra", async () => {
    const a = addAssignment({ status: "pending" });
    const res = await caseVideoAccess(user("seeker", OTHER_SEEKER), a._id);
    expect(res.status).toBe(400);
  });
});

// ---------- T18.9: the same room, found from the request ----------

describe("requestVideoAccess", () => {
  it("refuses an id that is not an ObjectId", async () => {
    const res = await requestVideoAccess(user("seeker", SEEKER), "nope");
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.message).toMatch(/invalid request id/i);
  });

  it("answers 404 when no case has been accepted for the request yet", async () => {
    const res = await requestVideoAccess(user("seeker", SEEKER), id());
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(res.message).toMatch(/no accepted consultation/i);
  });

  it("does not find a case that is only pending", async () => {
    const a = addAssignment({ status: "pending" });
    const res = await requestVideoAccess(user("seeker", SEEKER), a.request._id);
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("lets the seeker on the request in", async () => {
    const a = addAssignment();
    const res = await requestVideoAccess(user("seeker", SEEKER), a.request._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(false);
  });

  it("lets the assigned psychologist in through the request too", async () => {
    const a = addAssignment();
    const res = await requestVideoAccess(user("psychologist", PSYCHOLOGIST), a.request._id);
    expect(res.ok).toBe(true);
    expect(res.isModerator).toBe(true);
  });

  it("keeps out a seeker who did not raise the request", async () => {
    const a = addAssignment();
    const res = await requestVideoAccess(user("seeker", OTHER_SEEKER), a.request._id);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("resolves to the SAME assignment the case lookup returns", async () => {
    // this is the one that matters: if these ever diverge, the seeker and the
    // psychologist end up in two different Jitsi rooms
    const a = addAssignment();
    const viaCase = await caseVideoAccess(user("psychologist", PSYCHOLOGIST), a._id);
    const viaRequest = await requestVideoAccess(user("seeker", SEEKER), a.request._id);
    expect(viaCase.ok).toBe(true);
    expect(viaRequest.ok).toBe(true);
    expect(String(viaRequest.assignment._id)).toBe(String(viaCase.assignment._id));
  });
});
