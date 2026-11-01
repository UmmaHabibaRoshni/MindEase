
const mongoose = require("mongoose");

// Unit tests for the workshop APIs (T12.6).
// Same style as psychologistCaseList.test.js: the models are mocked over a
// small in-memory store, so no database runs. Role checks (facilitator /
// seeker) live in the route middleware, so they are not tested here.

const mockStore = { workshops: [], enrollments: [] };

const mockNewId = () => new (require("mongoose").Types.ObjectId)();
const mockSame = (a, b) => String(a) === String(b);

const mockWorkshopMatches = (w, f) => {
  if (f._id !== undefined && !mockSame(w._id, f._id)) return false;
  if (f.facilitator !== undefined && !mockSame(w.facilitator, f.facilitator)) return false;
  if (f.status !== undefined && w.status !== f.status) return false;
  if (f.date && f.date.$gte && !(new Date(w.date) >= f.date.$gte)) return false;
  if (f.enrolledCount && f.enrolledCount.$gt !== undefined && !(w.enrolledCount > f.enrolledCount.$gt)) {
    return false;
  }
  // the only $expr the controller uses is "enrolledCount < capacity"
  if (f.$expr && !(w.enrolledCount < w.capacity)) return false;
  return true;
};

jest.mock("../models/Workshop", () => {
  const rowsFor = (f) => mockStore.workshops.filter((w) => mockWorkshopMatches(w, f));

  return {
    create: jest.fn(async (data) => {
      if (!data.title) {
        const err = new Error("validation failed");
        err.name = "ValidationError";
        err.errors = { title: { message: "Workshop title is required" } };
        throw err;
      }
      const row = {
        _id: mockNewId(),
        status: "Scheduled",
        enrolledCount: 0,
        ...data,
        set(d) {
          Object.assign(this, d);
        },
        async save() {
          return this;
        },
        async cancelWorkshop() {
          this.status = "Cancelled";
          return this;
        },
        // listAvailableWorkshops serialises each row before adding isEnrolled
        toJSON() {
          const { set, save, cancelWorkshop, toJSON, ...plain } = this;
          return plain;
        },
      };
      mockStore.workshops.push(row);
      return row;
    }),
    findOne: jest.fn(async (f) => rowsFor(f)[0] || null),
    findById: jest.fn(
      async (id) => mockStore.workshops.find((w) => mockSame(w._id, id)) || null
    ),
    find: jest.fn((f) => {
      const rows = rowsFor(f);
      const chain = {
        populate: () => chain,
        sort: async () => [...rows].sort((a, b) => new Date(a.date) - new Date(b.date)),
      };
      return chain;
    }),
    // checks the filter and changes the row in one step, like MongoDB does
    findOneAndUpdate: jest.fn(async (f, update) => {
      const row = rowsFor(f)[0];
      if (!row) return null;
      if (update.$inc) Object.entries(update.$inc).forEach(([k, v]) => (row[k] += v));
      return row;
    }),
    updateOne: jest.fn(async (f, update) => {
      const row = rowsFor(f)[0];
      if (row && update.$inc) Object.entries(update.$inc).forEach(([k, v]) => (row[k] += v));
      return { modifiedCount: row ? 1 : 0 };
    }),
  };
});

jest.mock("../models/WorkshopEnrollment", () => {
  const mockIn = (value, filter) =>
    filter && filter.$in
      ? filter.$in.some((v) => mockSame(value, v))
      : mockSame(value, filter);

  const matches = (e, f) =>
    (f.workshop === undefined || mockIn(e.workshop, f.workshop)) &&
    (f.seeker === undefined || mockSame(e.seeker, f.seeker)) &&
    (f.status === undefined ||
      (f.status.$in ? f.status.$in.includes(e.status) : e.status === f.status));

  return {
    create: jest.fn(async (data) => {
      // stands in for the unique { workshop, seeker } index
      const duplicate = mockStore.enrollments.some(
        (e) => mockSame(e.workshop, data.workshop) && mockSame(e.seeker, data.seeker)
      );
      if (duplicate) {
        const err = new Error("duplicate key");
        err.code = 11000;
        throw err;
      }
      const row = {
        _id: mockNewId(),
        status: "Enrolled",
        enrolledAt: new Date(),
        cancellationReason: null,
        cancelledAt: null,
        ...data,
      };
      mockStore.enrollments.push(row);
      return row;
    }),
    findOneAndUpdate: jest.fn(async (f, update) => {
      const row = mockStore.enrollments.find((e) => matches(e, f));
      if (!row) return null;
      Object.assign(row, update.$set);
      return row;
    }),
    updateMany: jest.fn(async (f, update) => {
      const rows = mockStore.enrollments.filter((e) => matches(e, f));
      rows.forEach((e) => Object.assign(e, update));
      return { modifiedCount: rows.length };
    }),
    // NEW: the controller reads who is enrolled before cancelling a workshop
    find: jest.fn((f) => ({
      select: async () => mockStore.enrollments.filter((e) => matches(e, f)),
    })),
  };
});

// NEW: the notification helper is mocked, so no database is needed
jest.mock("../utils/notify", () => ({
  notify: jest.fn(async () => null),
  notifyMany: jest.fn(async () => []),
}));

const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");
const {
  createWorkshop,
  updateWorkshop,
  cancelWorkshop,
  listAvailableWorkshops,
  enroll,
  cancelEnrollment,
} = require("../controllers/workshopController");

beforeEach(() => {
  mockStore.workshops = [];
  mockStore.enrollments = [];
});

// ---------- helpers ----------

const newId = () => new mongoose.Types.ObjectId();

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

// run a controller with a fake request and collect status + body
const call = async (handler, { user, params = {}, body = {} } = {}) => {
  const out = { status: 200, body: undefined };
  const res = {
    status(code) {
      out.status = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
  };
  await handler({ user, params, body }, res);
  return out;
};

const facilitatorUser = () => ({ id: String(newId()), status: "approved" });
const seekerUser = () => ({ id: String(newId()), status: "approved" });

const validBody = (overrides = {}) => ({
  title: "Coping With Exam Anxiety",
  description: "A practical session on calming techniques before exams.",
  date: daysFromNow(10).toISOString(),
  time: "10:30 AM",
  durationMinutes: 60,
  mode: "Online",
  locationOrLink: "https://meet.example.com/abc",
  capacity: 5,
  ...overrides,
});

const makeWorkshop = (overrides = {}) =>
  Workshop.create({
    ...validBody(),
    date: daysFromNow(10),
    facilitator: String(newId()),
    ...overrides,
  });

const idOf = (w) => ({ id: String(w._id) });

// ---------- facilitator: create ----------

describe("createWorkshop", () => {
  test("creates a workshop with status Scheduled and 0 enrolled", async () => {
    const user = facilitatorUser();
    const r = await call(createWorkshop, { user, body: validBody() });

    expect(r.status).toBe(201);
    expect(r.body.workshop.status).toBe("Scheduled");
    expect(r.body.workshop.enrolledCount).toBe(0);
    expect(String(r.body.workshop.facilitator)).toBe(user.id);
  });

  test("ignores status and enrolledCount sent in the body", async () => {
    const r = await call(createWorkshop, {
      user: facilitatorUser(),
      body: validBody({ status: "Completed", enrolledCount: 99 }),
    });

    expect(r.status).toBe(201);
    expect(r.body.workshop.status).toBe("Scheduled");
    expect(r.body.workshop.enrolledCount).toBe(0);
  });

  test("rejects a missing title with 400", async () => {
    const body = validBody();
    delete body.title;
    const r = await call(createWorkshop, { user: facilitatorUser(), body });

    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/title/i);
  });

  test("rejects a past date with 400", async () => {
    const r = await call(createWorkshop, {
      user: facilitatorUser(),
      body: validBody({ date: daysFromNow(-3).toISOString() }),
    });

    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/past/i);
  });

  test("rejects an invalid date with 400", async () => {
    const r = await call(createWorkshop, {
      user: facilitatorUser(),
      body: validBody({ date: "not-a-date" }),
    });

    expect(r.status).toBe(400);
  });

  test("blocks a facilitator who is not approved with 403", async () => {
    const r = await call(createWorkshop, {
      user: { id: String(newId()), status: "pending" },
      body: validBody(),
    });

    expect(r.status).toBe(403);
  });
});

// ---------- facilitator: update ----------

describe("updateWorkshop", () => {
  test("updates an own workshop", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id });

    const r = await call(updateWorkshop, {
      user,
      params: idOf(w),
      body: { title: "A New Workshop Title" },
    });

    expect(r.status).toBe(200);
    expect(r.body.workshop.title).toBe("A New Workshop Title");
  });

  test("returns 404 for another facilitator's workshop", async () => {
    const w = await makeWorkshop();

    const r = await call(updateWorkshop, {
      user: facilitatorUser(),
      params: idOf(w),
      body: { title: "Trying to edit someone else" },
    });

    expect(r.status).toBe(404);
  });

  test("blocks capacity lower than the seats already taken", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id, capacity: 5, enrolledCount: 3 });

    const r = await call(updateWorkshop, { user, params: idOf(w), body: { capacity: 2 } });

    expect(r.status).toBe(400);
  });

  test("returns 400 when no valid field is sent", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id });

    const r = await call(updateWorkshop, { user, params: idOf(w), body: { status: "Completed" } });

    expect(r.status).toBe(400);
  });

  test("returns 400 for an invalid id", async () => {
    const r = await call(updateWorkshop, {
      user: facilitatorUser(),
      params: { id: "abc" },
      body: { title: "Does not matter here" },
    });

    expect(r.status).toBe(400);
  });
});

// ---------- facilitator: cancel ----------

describe("cancelWorkshop", () => {
  test("cancels the workshop and its enrollments", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id, enrolledCount: 1 });
    await WorkshopEnrollment.create({ workshop: w._id, seeker: newId() });

    const r = await call(cancelWorkshop, { user, params: idOf(w) });

    expect(r.status).toBe(200);
    expect(r.body.workshop.status).toBe("Cancelled");
    expect(r.body.enrollmentsCancelled).toBe(1);
    expect(mockStore.enrollments[0].status).toBe("Cancelled");
  });

  test("blocks a second cancel with 400", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id });

    await call(cancelWorkshop, { user, params: idOf(w) });
    const r = await call(cancelWorkshop, { user, params: idOf(w) });

    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/already cancelled/i);
  });

  test("blocks editing after cancel with 400", async () => {
    const user = facilitatorUser();
    const w = await makeWorkshop({ facilitator: user.id });

    await call(cancelWorkshop, { user, params: idOf(w) });
    const r = await call(updateWorkshop, {
      user,
      params: idOf(w),
      body: { title: "Edit after cancel" },
    });

    expect(r.status).toBe(400);
  });

  test("returns 404 for another facilitator's workshop", async () => {
    const w = await makeWorkshop();
    const r = await call(cancelWorkshop, { user: facilitatorUser(), params: idOf(w) });

    expect(r.status).toBe(404);
  });
});

// ---------- seeker: list ----------

describe("listAvailableWorkshops", () => {
  test("shows scheduled upcoming workshops and hides cancelled ones", async () => {
    await makeWorkshop({ title: "Open workshop one" });
    await makeWorkshop({ title: "Cancelled workshop", status: "Cancelled" });

    const r = await call(listAvailableWorkshops, { user: seekerUser() });

    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].title).toBe("Open workshop one");
  });

  // The page reads isEnrolled to decide between "Enroll" and "You are
  // enrolled", and since T18.7 to decide whether to offer the video room.
  // Before this it was never sent, so a reload lost the fact.
  test("marks a workshop the caller is already enrolled in", async () => {
    const w = await makeWorkshop({ title: "Already joined" });
    const seeker = seekerUser();
    await WorkshopEnrollment.create({ workshop: w._id, seeker: seeker.id });

    const r = await call(listAvailableWorkshops, { user: seeker });

    expect(r.status).toBe(200);
    expect(r.body[0].isEnrolled).toBe(true);
  });

  test("does not mark a workshop the caller has not joined", async () => {
    await makeWorkshop({ title: "Not joined" });

    const r = await call(listAvailableWorkshops, { user: seekerUser() });

    expect(r.body[0].isEnrolled).toBe(false);
  });

  test("does not mark another seeker's enrollment as the caller's", async () => {
    const w = await makeWorkshop({ title: "Someone else joined" });
    await WorkshopEnrollment.create({ workshop: w._id, seeker: newId() });

    const r = await call(listAvailableWorkshops, { user: seekerUser() });

    expect(r.body[0].isEnrolled).toBe(false);
  });


  test("hides workshops whose date has passed", async () => {
    await makeWorkshop({ title: "Old workshop", date: daysFromNow(-5) });

    const r = await call(listAvailableWorkshops, { user: seekerUser() });

    expect(r.body).toHaveLength(0);
  });
});

// ---------- seeker: enroll ----------

describe("enroll", () => {
  test("enrolls a seeker and raises enrolledCount by 1", async () => {
    const w = await makeWorkshop();
    const r = await call(enroll, { user: seekerUser(), params: idOf(w) });

    expect(r.status).toBe(201);
    expect(r.body.enrollment.status).toBe("Enrolled");
    expect(w.enrolledCount).toBe(1);
  });

  test("blocks a duplicate enrollment with 409 and keeps the count", async () => {
    const w = await makeWorkshop();
    const user = seekerUser();

    await call(enroll, { user, params: idOf(w) });
    const r = await call(enroll, { user, params: idOf(w) });

    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/already enrolled/i);
    expect(w.enrolledCount).toBe(1);
    expect(mockStore.enrollments).toHaveLength(1);
  });

  test("returns 409 when the workshop is full", async () => {
    const w = await makeWorkshop({ capacity: 1 });

    await call(enroll, { user: seekerUser(), params: idOf(w) });
    const r = await call(enroll, { user: seekerUser(), params: idOf(w) });

    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/full/i);
    expect(w.enrolledCount).toBe(1);
    expect(mockStore.enrollments).toHaveLength(1);
  });

  test("returns 400 for a cancelled workshop", async () => {
    const w = await makeWorkshop({ status: "Cancelled" });
    const r = await call(enroll, { user: seekerUser(), params: idOf(w) });

    expect(r.status).toBe(400);
  });

  test("returns 400 for a workshop whose date has passed", async () => {
    const w = await makeWorkshop({ date: daysFromNow(-2) });
    const r = await call(enroll, { user: seekerUser(), params: idOf(w) });

    expect(r.status).toBe(400);
  });

  test("returns 404 for a workshop that does not exist", async () => {
    const r = await call(enroll, { user: seekerUser(), params: { id: String(newId()) } });

    expect(r.status).toBe(404);
  });

  test("returns 400 for an invalid id", async () => {
    const r = await call(enroll, { user: seekerUser(), params: { id: "abc" } });

    expect(r.status).toBe(400);
  });
});

// ---------- seeker: cancel enrollment ----------

describe("cancelEnrollment", () => {
  test("cancels the enrollment and gives the seat back", async () => {
    const w = await makeWorkshop();
    const user = seekerUser();
    await call(enroll, { user, params: idOf(w) });

    const r = await call(cancelEnrollment, { user, params: idOf(w) });

    expect(r.status).toBe(200);
    expect(r.body.enrollment.status).toBe("Cancelled");
    expect(r.body.enrollment.cancelledAt).toBeInstanceOf(Date);
    expect(w.enrolledCount).toBe(0);
  });

  test("stores the reason when one is sent", async () => {
    const w = await makeWorkshop();
    const user = seekerUser();
    await call(enroll, { user, params: idOf(w) });

    const r = await call(cancelEnrollment, {
      user,
      params: idOf(w),
      body: { reason: "I am busy that day" },
    });

    expect(r.body.enrollment.cancellationReason).toBe("I am busy that day");
  });

  test("a second cancel returns 404 and does not lower the count again", async () => {
    const w = await makeWorkshop();
    const user = seekerUser();
    await call(enroll, { user, params: idOf(w) });
    await call(enroll, { user: seekerUser(), params: idOf(w) });

    await call(cancelEnrollment, { user, params: idOf(w) });
    const r = await call(cancelEnrollment, { user, params: idOf(w) });

    expect(r.status).toBe(404);
    expect(w.enrolledCount).toBe(1); // the other seeker is still in
  });

  test("a seeker can enroll again after cancelling", async () => {
    const w = await makeWorkshop();
    const user = seekerUser();

    await call(enroll, { user, params: idOf(w) });
    await call(cancelEnrollment, { user, params: idOf(w) });
    const r = await call(enroll, { user, params: idOf(w) });

    expect(r.status).toBe(201);
    expect(r.body.enrollment.status).toBe("Enrolled");
    expect(r.body.enrollment.cancelledAt).toBeNull();
    expect(w.enrolledCount).toBe(1);
    expect(mockStore.enrollments).toHaveLength(1); // still one record per seeker
  });

  test("returns 404 for a seeker who never enrolled", async () => {
    const w = await makeWorkshop();
    const r = await call(cancelEnrollment, { user: seekerUser(), params: idOf(w) });

    expect(r.status).toBe(404);
  });

  test("returns 400 for an invalid id", async () => {
    const r = await call(cancelEnrollment, { user: seekerUser(), params: { id: "abc" } });

    expect(r.status).toBe(400);
  });
});