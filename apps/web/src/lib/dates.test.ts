import { describe, expect, it } from "vitest";
import { addMonthsClamped, dateInputInAppTimeZone, toCompetenceMonth } from "./dates";

describe("dateInputInAppTimeZone", () => {
  it("21h–23h59 de Brasília ainda é o mesmo dia (em UTC já virou)", () => {
    // 30/10 22:00 em São Paulo = 31/10 01:00 UTC
    expect(dateInputInAppTimeZone("2026-10-31T01:00:00+00:00")).toBe("2026-10-30");
    expect(dateInputInAppTimeZone("2026-10-31T02:59:59Z")).toBe("2026-10-30");
  });

  it("a partir de 03:00 UTC já é o dia novo em Brasília", () => {
    expect(dateInputInAppTimeZone("2026-10-31T03:00:00Z")).toBe("2026-10-31");
  });

  it("virada de ano", () => {
    expect(dateInputInAppTimeZone("2027-01-01T02:30:00Z")).toBe("2026-12-31");
  });

  it("aceita Date", () => {
    expect(dateInputInAppTimeZone(new Date("2026-06-15T15:00:00Z"))).toBe("2026-06-15");
  });
});

describe("addMonthsClamped", () => {
  it("dia 31 cai no último dia do mês curto", () => {
    expect(addMonthsClamped("2026-08-31", 1)).toBe("2026-09-30");
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("atravessa o ano", () => {
    expect(addMonthsClamped("2026-11-01", 3)).toBe("2027-02-01");
  });
});

describe("toCompetenceMonth", () => {
  it("sempre o dia 1 do mês da data", () => {
    expect(toCompetenceMonth("2026-10-12")).toBe("2026-10-01");
  });
});
