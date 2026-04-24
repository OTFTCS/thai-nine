import test from "node:test";
import assert from "node:assert/strict";
import {
  computeOpenSlots,
  type AvailabilityRule,
  type AvailabilityOverride,
  type ExistingBooking,
} from "../../src/lib/booking/availability.ts";

function bkkRule(overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    id: "r1",
    teacher_id: "t1",
    timezone: "Asia/Bangkok",
    weekday: 1,
    start_time: "10:00:00",
    end_time: "12:00:00",
    slot_duration_minutes: 60,
    active: true,
    ...overrides,
  };
}

test("empty rules yields empty slots", () => {
  const slots = computeOpenSlots({
    rules: [],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 0);
});

test("Bangkok weekly rule produces correct UTC slots on Monday", () => {
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 2);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T03:00:00.000Z");
  assert.equal(slots[0].endUtc.toISOString(), "2026-04-27T04:00:00.000Z");
  assert.equal(slots[1].startUtc.toISOString(), "2026-04-27T04:00:00.000Z");
  assert.equal(slots[1].endUtc.toISOString(), "2026-04-27T05:00:00.000Z");
});

test("rule with weekday mismatch yields no slots", () => {
  const slots = computeOpenSlots({
    rules: [bkkRule({ weekday: 3 })],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 0);
});

test("existing confirmed booking removes its slot", () => {
  const bookings: ExistingBooking[] = [
    {
      starts_at: "2026-04-27T03:00:00Z",
      ends_at: "2026-04-27T04:00:00Z",
      status: "confirmed",
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides: [],
    bookings,
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T04:00:00.000Z");
});

test("pending_payment booking also blocks the slot", () => {
  const bookings: ExistingBooking[] = [
    {
      starts_at: "2026-04-27T04:00:00Z",
      ends_at: "2026-04-27T05:00:00Z",
      status: "pending_payment",
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides: [],
    bookings,
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T03:00:00.000Z");
});

test("cancelled booking does not block the slot", () => {
  const bookings: ExistingBooking[] = [
    {
      starts_at: "2026-04-27T03:00:00Z",
      ends_at: "2026-04-27T04:00:00Z",
      status: "cancelled",
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides: [],
    bookings,
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 2);
});

test("full-day block override removes all slots that day", () => {
  const overrides: AvailabilityOverride[] = [
    {
      id: "o1",
      teacher_id: "t1",
      date: "2026-04-27",
      start_time: null,
      end_time: null,
      kind: "block",
      slot_duration_minutes: null,
      timezone: null,
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides,
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 0);
});

test("partial block override removes only the overlapping portion", () => {
  const overrides: AvailabilityOverride[] = [
    {
      id: "o1",
      teacher_id: "t1",
      date: "2026-04-27",
      start_time: "10:00:00",
      end_time: "11:00:00",
      kind: "block",
      slot_duration_minutes: null,
      timezone: null,
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides,
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T04:00:00.000Z");
});

test("add override contributes extra slots on a non-rule day", () => {
  const overrides: AvailabilityOverride[] = [
    {
      id: "o1",
      teacher_id: "t1",
      date: "2026-04-28",
      start_time: "09:00:00",
      end_time: "10:00:00",
      kind: "add",
      slot_duration_minutes: null,
      timezone: null,
    },
  ];
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides,
    bookings: [],
    from: new Date("2026-04-28T00:00:00Z"),
    to: new Date("2026-04-28T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-28T02:00:00.000Z");
  assert.equal(slots[0].endUtc.toISOString(), "2026-04-28T03:00:00.000Z");
});

test("90-minute slots across a 2-hour window yield one full slot", () => {
  const slots = computeOpenSlots({
    rules: [bkkRule({ slot_duration_minutes: 90 })],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T03:00:00.000Z");
  assert.equal(slots[0].endUtc.toISOString(), "2026-04-27T04:30:00.000Z");
});

test("London teacher rule respects DST: BST and GMT produce different UTC slots", () => {
  const ukRule: AvailabilityRule = {
    id: "r1",
    teacher_id: "t1",
    timezone: "Europe/London",
    weekday: 1,
    start_time: "10:00:00",
    end_time: "11:00:00",
    slot_duration_minutes: 60,
    active: true,
  };

  // 2026-10-19 is a Monday in BST (UTC+1). 10:00 local = 09:00 UTC.
  const bst = computeOpenSlots({
    rules: [ukRule],
    overrides: [],
    bookings: [],
    from: new Date("2026-10-19T00:00:00Z"),
    to: new Date("2026-10-19T23:59:59Z"),
    studentTz: "Asia/Bangkok",
  });
  assert.equal(bst.length, 1);
  assert.equal(bst[0].startUtc.toISOString(), "2026-10-19T09:00:00.000Z");

  // 2026-11-02 is a Monday in GMT (UTC+0), after DST ends 2026-10-25. 10:00 local = 10:00 UTC.
  const gmt = computeOpenSlots({
    rules: [ukRule],
    overrides: [],
    bookings: [],
    from: new Date("2026-11-02T00:00:00Z"),
    to: new Date("2026-11-02T23:59:59Z"),
    studentTz: "Asia/Bangkok",
  });
  assert.equal(gmt.length, 1);
  assert.equal(gmt[0].startUtc.toISOString(), "2026-11-02T10:00:00.000Z");
});

test("inactive rule yields no slots", () => {
  const slots = computeOpenSlots({
    rules: [bkkRule({ active: false })],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 0);
});

test("slots outside [from, to] are filtered out", () => {
  const slots = computeOpenSlots({
    rules: [bkkRule()],
    overrides: [],
    bookings: [],
    from: new Date("2026-04-27T04:00:00Z"),
    to: new Date("2026-04-27T23:59:59Z"),
    studentTz: "Europe/London",
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startUtc.toISOString(), "2026-04-27T04:00:00.000Z");
});
