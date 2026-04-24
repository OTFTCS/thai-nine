import { fromZonedTime } from "date-fns-tz";

export type AvailabilityRule = {
  id: string;
  teacher_id: string;
  timezone: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  active: boolean;
};

export type AvailabilityOverride = {
  id: string;
  teacher_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  kind: "add" | "block";
  slot_duration_minutes: number | null;
  timezone: string | null;
};

export type ExistingBooking = {
  starts_at: string | Date;
  ends_at: string | Date;
  status: string;
};

export type OpenSlot = {
  startUtc: Date;
  endUtc: Date;
};

export type ComputeOpenSlotsInput = {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  bookings: ExistingBooking[];
  from: Date;
  to: Date;
  studentTz: string;
};

export function computeOpenSlots(input: ComputeOpenSlotsInput): OpenSlot[] {
  const { rules, overrides, bookings, from, to } = input;
  if (rules.length === 0) return [];

  const activeRules = rules.filter((r) => r.active);
  if (activeRules.length === 0) return [];

  const teacherTz = activeRules[0].timezone;

  const expandedFrom = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const expandedTo = new Date(to.getTime() + 24 * 60 * 60 * 1000);

  const localDates = enumerateLocalDates(expandedFrom, expandedTo, teacherTz);

  const overrideIndex = new Map<string, AvailabilityOverride[]>();
  for (const o of overrides) {
    const list = overrideIndex.get(o.date) ?? [];
    list.push(o);
    overrideIndex.set(o.date, list);
  }

  const slots: OpenSlot[] = [];

  for (const localDate of localDates) {
    const weekday = getWeekdayInTz(localDate, teacherTz);
    const dateOverrides = overrideIndex.get(localDate) ?? [];
    const blocks = dateOverrides.filter((o) => o.kind === "block");
    const adds = dateOverrides.filter((o) => o.kind === "add");

    const fullDayBlocked = blocks.some((b) => !b.start_time && !b.end_time);
    const partialBlocks = blocks.filter((b) => b.start_time && b.end_time);

    if (!fullDayBlocked) {
      for (const rule of activeRules) {
        if (rule.weekday !== weekday) continue;
        const subranges = subtractBlocks(
          [{ start: rule.start_time, end: rule.end_time }],
          partialBlocks.map((b) => ({ start: b.start_time!, end: b.end_time! })),
        );
        for (const r of subranges) {
          for (const slot of chunkToSlots(
            localDate,
            r.start,
            r.end,
            rule.slot_duration_minutes,
            teacherTz,
          )) {
            slots.push(slot);
          }
        }
      }
    }

    for (const add of adds) {
      if (!add.start_time || !add.end_time) continue;
      const tz = add.timezone ?? teacherTz;
      const dur = add.slot_duration_minutes ?? activeRules[0].slot_duration_minutes;
      for (const slot of chunkToSlots(localDate, add.start_time, add.end_time, dur, tz)) {
        slots.push(slot);
      }
    }
  }

  const inRange = slots.filter((s) => s.startUtc >= from && s.endUtc <= to);

  const busy = bookings
    .filter((b) => b.status === "pending_payment" || b.status === "confirmed")
    .map((b) => ({
      start: b.starts_at instanceof Date ? b.starts_at : new Date(b.starts_at),
      end: b.ends_at instanceof Date ? b.ends_at : new Date(b.ends_at),
    }));

  const open = inRange.filter(
    (s) => !busy.some((b) => s.startUtc < b.end && b.start < s.endUtc),
  );

  const seen = new Set<number>();
  return open
    .sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime())
    .filter((s) => {
      const key = s.startUtc.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function chunkToSlots(
  localDate: string,
  startTime: string,
  endTime: string,
  slotMinutes: number,
  tz: string,
): OpenSlot[] {
  const startUtc = fromZonedTime(`${localDate}T${normalizeTime(startTime)}`, tz);
  const endUtc = fromZonedTime(`${localDate}T${normalizeTime(endTime)}`, tz);
  const slotMs = slotMinutes * 60 * 1000;
  const out: OpenSlot[] = [];
  for (let t = startUtc.getTime(); t + slotMs <= endUtc.getTime(); t += slotMs) {
    out.push({ startUtc: new Date(t), endUtc: new Date(t + slotMs) });
  }
  return out;
}

function subtractBlocks(
  ranges: { start: string; end: string }[],
  blocks: { start: string; end: string }[],
): { start: string; end: string }[] {
  if (blocks.length === 0) return ranges;
  const toMin = (t: string): number => {
    const [h, m] = normalizeTime(t).split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (min: number): string => {
    const h = Math.floor(min / 60)
      .toString()
      .padStart(2, "0");
    const m = (min % 60).toString().padStart(2, "0");
    return `${h}:${m}:00`;
  };
  let segs = ranges.map((r) => ({ s: toMin(r.start), e: toMin(r.end) }));
  for (const b of blocks) {
    const bs = toMin(b.start);
    const be = toMin(b.end);
    const next: { s: number; e: number }[] = [];
    for (const seg of segs) {
      if (be <= seg.s || bs >= seg.e) {
        next.push(seg);
        continue;
      }
      if (bs > seg.s) next.push({ s: seg.s, e: Math.min(bs, seg.e) });
      if (be < seg.e) next.push({ s: Math.max(be, seg.s), e: seg.e });
    }
    segs = next;
  }
  return segs
    .filter((s) => s.e > s.s)
    .map((s) => ({ start: toTime(s.s), end: toTime(s.e) }));
}

function enumerateLocalDates(from: Date, to: Date, tz: string): string[] {
  const set = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime(); t += 6 * 60 * 60 * 1000) {
    set.add(formatDateInTz(new Date(t), tz));
  }
  set.add(formatDateInTz(to, tz));
  return Array.from(set).sort();
}

function formatDateInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function getWeekdayInTz(localDate: string, tz: string): number {
  const noonUtc = fromZonedTime(`${localDate}T12:00:00`, tz);
  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noonUtc);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekdayStr] ?? 0;
}

function normalizeTime(t: string): string {
  if (t.length === 5) return `${t}:00`;
  return t;
}
