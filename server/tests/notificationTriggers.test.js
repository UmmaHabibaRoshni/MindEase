
const mongoose = require("mongoose");

// Unit tests for the notification triggers (T15.6).
// The models are mocked, so no database runs. The notify helper is mocked
// too, so each test only checks who would be notified and with what.

jest.mock("../utils/notify", () => ({ notify: jest.fn(), notifyMany: jest.fn() }));
jest.mock("../models/Notification", () => ({ create: jest.fn(), insertMany: jest.fn() }));
jest.mock("../models/CrisisRequest", () => ({
  findOneAndUpdate: jest.fn(),
  exists: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock("../models/Ngo", () => ({ findById: jest.fn() }));
jest.mock("../models/User", () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock("../models/Referral", () => ({
  create: jest.fn(),
  REFERRAL_STATUSES: ["pending", "accepted", "declined"],
  NOTE_MAX: 500,
}));
jest.mock("../models/Workshop", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock("../models/WorkshopEnrollment", () => ({
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  updateMany: jest.fn(),
}));

const { notify, notifyMany } = require("../utils/notify");
const Notification = require("../models/Notification");
const CrisisRequest = require("../models/CrisisRequest");
const Ngo = require("../models/Ngo");
const User = require("../models/User");
const Referral = require("../models/Referral");
const Workshop = require("../models/Workshop");
const WorkshopEnrollment = require("../models/WorkshopEnrollment");

const { acceptRequest } = require("../controllers/requestController");
const { createReferral } = require("../controllers/referralController");
const { approveUser, rejectUser } = require("../controllers/adminController");
const { enroll, cancelWorkshop } = require("../controllers/workshopController");

beforeEach(() => {
  jest.resetAllMocks();
});

// ---------- helpers ----------

const id = () => String(new mongoose.Types.ObjectId());

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const approved = (userId) => ({ id: userId, status: "approved" });
const futureDate = () => new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

// ---------- request accepted ----------

describe("request accepted", () => {
  test("notifies the seeker", async () => {
    const [seekerId, volunteerId, requestId] = [id(), id(), id()];
    CrisisRequest.findOneAndUpdate.mockResolvedValue({ _id: requestId, seeker: seekerId });
    const res = makeRes();

    await acceptRequest({ params: { id: requestId }, user: approved(volunteerId) }, res);

    expect(notify).toHaveBeenCalledWith(
      seekerId,
      "request_accepted",
      expect.any(String),
      "/dashboard/seeker"
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Request accepted" }));
  });

  test("sends nothing when the request was already accepted", async () => {
    CrisisRequest.findOneAndUpdate.mockResolvedValue(null);
    CrisisRequest.exists.mockResolvedValue({ _id: "x" });
    const res = makeRes();

    await acceptRequest({ params: { id: id() }, user: approved(id()) }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(notify).not.toHaveBeenCalled();
  });
});

// ---------- referral created ----------

describe("referral created", () => {
  const [seekerId, volunteerId, requestId, ngoId, ngoUserId] = [id(), id(), id(), id(), id()];
  const req = () => ({
    body: { requestId, ngoId, consent: true },
    user: approved(volunteerId),
  });

  const setup = () => {
    Ngo.findById.mockResolvedValue({ user: ngoUserId, categories: ["legal_aid"] });
    User.findOne.mockResolvedValue({ _id: ngoUserId });
    CrisisRequest.findById.mockResolvedValue({ _id: requestId, seeker: seekerId, category: "legal_aid" });
    CrisisRequest.findOneAndUpdate.mockResolvedValue({ _id: requestId });
    Referral.create.mockResolvedValue({ _id: "r1" });
  };

  test("notifies the seeker and the NGO", async () => {
    setup();
    const res = makeRes();

    await createReferral(req(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(seekerId, "referral_created", expect.any(String), "/dashboard/seeker");
    expect(notify).toHaveBeenCalledWith(ngoUserId, "referral_created", expect.any(String), "/dashboard/ngo");
  });

  test("sends nothing when the volunteer did not accept the request", async () => {
    setup();
    CrisisRequest.findOneAndUpdate.mockResolvedValue(null);
    const res = makeRes();

    await createReferral(req(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(notify).not.toHaveBeenCalled();
  });

  test("sends nothing when the referral could not be saved", async () => {
    setup();
    Referral.create.mockRejectedValue(new Error("db down"));
    CrisisRequest.updateOne.mockResolvedValue({});
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();

    await createReferral(req(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(CrisisRequest.updateOne).toHaveBeenCalled(); // rolled back
    expect(notify).not.toHaveBeenCalled();
  });
});

// ---------- account approved or rejected ----------

describe("account approved or rejected", () => {
  const userId = id();
  const pendingUser = (status = "pending") => ({
    _id: userId,
    status,
    save: jest.fn().mockResolvedValue(),
    toObject() {
      return { _id: this._id, status: this.status, password: "hash" };
    },
  });
  const req = (body = {}) => ({ params: { id: userId }, user: { id: id() }, body });

  test("approving notifies the user", async () => {
    User.findById.mockResolvedValue(pendingUser());

    await approveUser(req(), makeRes());

    expect(notify).toHaveBeenCalledWith(userId, "account_approved", expect.any(String), "/dashboard");
  });

  test("rejecting notifies the user and includes the reason", async () => {
    User.findById.mockResolvedValue(pendingUser());

    await rejectUser(req({ reason: "Documents unclear" }), makeRes());

    expect(notify).toHaveBeenCalledWith(
      userId,
      "account_rejected",
      expect.stringContaining("Documents unclear"),
      "/login"
    );
  });

  test("sends nothing for an account that is not pending", async () => {
    User.findById.mockResolvedValue(pendingUser("approved"));
    const res = makeRes();

    await approveUser(req(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(notify).not.toHaveBeenCalled();
  });
});

// ---------- workshop enrolled and cancelled ----------

describe("workshop enrolled", () => {
  const [workshopId, seekerId] = [id(), id()];
  const req = () => ({ params: { id: workshopId }, user: approved(seekerId) });

  test("notifies the seeker who enrolled", async () => {
    Workshop.findOneAndUpdate.mockResolvedValue({ _id: workshopId, title: "Exam Stress Workshop" });
    WorkshopEnrollment.findOneAndUpdate.mockResolvedValue(null);
    WorkshopEnrollment.create.mockResolvedValue({ status: "Enrolled" });
    const res = makeRes();

    await enroll(req(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(notify).toHaveBeenCalledWith(
      seekerId,
      "workshop_enrolled",
      expect.stringContaining("Exam Stress Workshop"),
      "/dashboard/workshops"
    );
  });

  test("sends nothing when the workshop is full", async () => {
    Workshop.findOneAndUpdate.mockResolvedValue(null);
    Workshop.findById.mockResolvedValue({ status: "Scheduled", date: futureDate() });
    const res = makeRes();

    await enroll(req(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(notify).not.toHaveBeenCalled();
  });

  test("sends nothing when the seeker is already enrolled", async () => {
    Workshop.findOneAndUpdate.mockResolvedValue({ _id: workshopId, title: "Exam Stress Workshop" });
    Workshop.updateOne.mockResolvedValue({});
    WorkshopEnrollment.findOneAndUpdate.mockResolvedValue(null);
    WorkshopEnrollment.create.mockRejectedValue({ code: 11000 });
    const res = makeRes();

    await enroll(req(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("workshop cancelled", () => {
  const [workshopId, facilitatorId, seekerA, seekerB] = [id(), id(), id(), id()];
  const req = () => ({ params: { id: workshopId }, user: approved(facilitatorId) });

  test("notifies every enrolled seeker", async () => {
    Workshop.findOne.mockResolvedValue({
      _id: workshopId,
      title: "Exam Stress Workshop",
      status: "Scheduled",
      cancelWorkshop: jest.fn().mockResolvedValue(),
    });
    WorkshopEnrollment.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ seeker: seekerA }, { seeker: seekerB }]),
    });
    WorkshopEnrollment.updateMany.mockResolvedValue({ modifiedCount: 2 });

    await cancelWorkshop(req(), makeRes());

    expect(notifyMany).toHaveBeenCalledWith(
      [seekerA, seekerB],
      "workshop_cancelled",
      expect.stringContaining("Exam Stress Workshop"),
      "/dashboard/workshops"
    );
  });

  test("sends nothing for a workshop that is already cancelled", async () => {
    Workshop.findOne.mockResolvedValue({ _id: workshopId, title: "x", status: "Cancelled" });
    const res = makeRes();

    await cancelWorkshop(req(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(notifyMany).not.toHaveBeenCalled();
  });
});

// ---------- the notify helper itself ----------

describe("notify helper", () => {
  const real = jest.requireActual("../utils/notify");
  const [a, b] = [id(), id()];

  test("creates one notification", async () => {
    Notification.create.mockResolvedValue({ _id: "n1" });

    await real.notify(a, "request_accepted", "hello", "/x");

    expect(Notification.create).toHaveBeenCalledWith({
      user: a,
      type: "request_accepted",
      message: "hello",
      link: "/x",
    });
  });

  test("skips a missing user and never throws on a database error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    Notification.create.mockRejectedValue(new Error("db down"));

    expect(await real.notify(null, "request_accepted", "hello")).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
    expect(await real.notify(a, "request_accepted", "hello")).toBeNull();
  });

  test("notifyMany makes one notification per distinct user", async () => {
    Notification.insertMany.mockResolvedValue([]);

    await real.notifyMany([a, a, b], "workshop_cancelled", "msg", "/y");

    expect(Notification.insertMany).toHaveBeenCalledWith([
      { user: a, type: "workshop_cancelled", message: "msg", link: "/y" },
      { user: b, type: "workshop_cancelled", message: "msg", link: "/y" },
    ]);
  });

  test("notifyMany does nothing for an empty list", async () => {
    await real.notifyMany([], "workshop_cancelled", "msg");

    expect(Notification.insertMany).not.toHaveBeenCalled();
  });
});