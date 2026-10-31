const { roomFor, roomName } = require("../utils/videoRoom");

// Unit tests for the room-name helper only (part of T18.2).
// The access rules get their own suite in T18.4.
//
// These matter because the room name is derived, not stored: if it stops being
// stable, two people "in the same workshop" quietly land in two empty rooms.

const ID = "6711f0abc123def456789012";
const OTHER_ID = "6711f0abc123def456789013";

const withEnv = (vars, fn) => {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    process.env = saved;
  }
};

describe("roomName", () => {
  it("gives the same name every time for the same id and salt", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      expect(roomName("workshop", ID)).toBe(roomName("workshop", ID));
    });
  });

  it("gives different names to different ids", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      expect(roomName("workshop", ID)).not.toBe(roomName("workshop", OTHER_ID));
    });
  });

  it("keeps a workshop and a case with the same id apart", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      expect(roomName("workshop", ID)).not.toBe(roomName("case", ID));
    });
  });

  it("changes when the salt changes, which is why the team shares one", () => {
    const a = withEnv({ VIDEO_ROOM_SECRET: "salt-a" }, () => roomName("workshop", ID));
    const b = withEnv({ VIDEO_ROOM_SECRET: "salt-b" }, () => roomName("workshop", ID));
    expect(a).not.toBe(b);
  });

  it("is safe to put in a URL: only letters, digits and dashes", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      expect(roomName("workshop", ID)).toMatch(/^[A-Za-z0-9-]+$/);
    });
  });

  it("accepts an ObjectId as well as a string", () => {
    const { Types } = require("mongoose");
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      expect(roomName("workshop", new Types.ObjectId(ID))).toBe(roomName("workshop", ID));
    });
  });
});

describe("roomFor", () => {
  it("builds the join URL from the configured domain", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt", JITSI_DOMAIN: "meet.example.org" }, () => {
      const room = roomFor("workshop", ID);
      expect(room.domain).toBe("meet.example.org");
      expect(room.url).toBe(`https://meet.example.org/${room.roomName}`);
    });
  });

  it("falls back to meet.jit.si when no domain is configured", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt", JITSI_DOMAIN: "" }, () => {
      expect(roomFor("workshop", ID).domain).toBe("meet.jit.si");
    });
  });

  it("passes through the display name, subject and moderator flag", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      const room = roomFor("workshop", ID, {
        displayName: "Test Facilitator",
        subject: "Managing exam stress",
        isModerator: true,
      });
      expect(room.displayName).toBe("Test Facilitator");
      expect(room.subject).toBe("Managing exam stress");
      expect(room.isModerator).toBe(true);
    });
  });

  it("defaults those fields rather than leaving them undefined", () => {
    withEnv({ VIDEO_ROOM_SECRET: "team-salt" }, () => {
      const room = roomFor("case", ID);
      expect(room.displayName).toBe("");
      expect(room.subject).toBe("");
      expect(room.isModerator).toBe(false);
    });
  });
});
