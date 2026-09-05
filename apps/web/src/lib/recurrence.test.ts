import { describe, expect, it } from "vitest";
import { installmentOccurrences, monthlyOccurrences } from "./recurrence";
import { addMonthsClamped } from "./dates";

describe("monthlyOccurrences", () => {
  it("começa no mês de início quando o vencimento ainda não passou", () => {
    const occ = monthlyOccurrences({
      startDate: "2026-01-03",
      dueDay: 10,
      today: "2026-03-31",
    });
    expect(occ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
  });

  it("pula para o mês seguinte quando o vencimento do mês de início já passou (achado 2.4)", () => {
    // criado em 20/08, vencimento dia 5 => primeira ocorrência 05/09, nunca 05/08
    const occ = monthlyOccurrences({
      startDate: "2026-08-20",
      dueDay: 5,
      today: "2026-11-30",
    });
    expect(occ[0]).toBe("2026-09-05");
    expect(occ).not.toContain("2026-08-05");
  });

  it("ajusta o dia para meses curtos", () => {
    const occ = monthlyOccurrences({
      startDate: "2026-01-31",
      dueDay: 31,
      today: "2026-03-31",
    });
    expect(occ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("não gera nada além de hoje", () => {
    const occ = monthlyOccurrences({
      startDate: "2026-01-10",
      dueDay: 10,
      today: "2026-01-09",
    });
    expect(occ).toEqual([]);
  });

  it("respeita end_date", () => {
    const occ = monthlyOccurrences({
      startDate: "2026-01-10",
      dueDay: 10,
      today: "2026-12-31",
      endDate: "2026-03-15",
    });
    expect(occ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
  });

  it("respeita months_ahead", () => {
    const occ = monthlyOccurrences({
      startDate: "2026-01-10",
      dueDay: 10,
      today: "2026-12-31",
      monthsAhead: 2,
    });
    expect(occ).toEqual(["2026-01-10", "2026-02-10"]);
  });
});

describe("installmentOccurrences", () => {
  it("gera parcelas 1..N até hoje", () => {
    const occ = installmentOccurrences({ startDate: "2026-01-15", count: 5, today: "2026-03-20" });
    expect(occ).toEqual([
      { number: 1, date: "2026-01-15" },
      { number: 2, date: "2026-02-15" },
      { number: 3, date: "2026-03-15" },
    ]);
  });

  it("não gera parcelas futuras", () => {
    const occ = installmentOccurrences({ startDate: "2026-01-15", count: 3, today: "2026-01-14" });
    expect(occ).toEqual([]);
  });

  it("a última parcela cai no mês certo", () => {
    const occ = installmentOccurrences({ startDate: "2026-01-31", count: 3, today: "2027-01-01" });
    expect(occ.map((o) => o.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("addMonthsClamped (regressão)", () => {
  it("vira o ano corretamente", () => {
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("ajusta 31 de janeiro + 1 mês", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  });
});
