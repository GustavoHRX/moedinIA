import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./formatters";
import { splitInstallments } from "./money";

describe("parseMoneyInput", () => {
  it("aceita formato BR com milhar", () => {
    expect(parseMoneyInput("1.200,50")).toBe(1200.5);
    expect(parseMoneyInput("35,90")).toBe(35.9);
    expect(parseMoneyInput("1.200.000")).toBe(1200000);
  });

  it("aceita ponto como decimal (o bug do 23.50)", () => {
    expect(parseMoneyInput("23.50")).toBe(23.5);
    expect(parseMoneyInput("5000.5")).toBe(5000.5);
    expect(parseMoneyInput("100.00")).toBe(100);
  });

  it("trata ponto com 3 casas como milhar", () => {
    expect(parseMoneyInput("1.200")).toBe(1200);
  });

  it("limpa prefixos e sinais", () => {
    expect(parseMoneyInput("R$ 50,00")).toBe(50);
    expect(parseMoneyInput("-10")).toBe(10);
  });

  it("vazio ou inválido vira 0", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("abc")).toBe(0);
    expect(parseMoneyInput(null)).toBe(0);
    expect(parseMoneyInput(undefined)).toBe(0);
  });

  it("número passa direto", () => {
    expect(parseMoneyInput(42.99)).toBe(42.99);
    expect(parseMoneyInput(Number.NaN)).toBe(0);
  });
});

describe("splitInstallments", () => {
  it("R$ 100 em 3x fecha exatamente 100 (achado 2.7)", () => {
    const parts = splitInstallments(100, 3);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it("divisão exata não muda nada", () => {
    expect(splitInstallments(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  it("distribui o resto nas últimas parcelas", () => {
    const parts = splitInstallments(100.05, 2);
    expect(parts).toEqual([50.02, 50.03]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100.05, 10);
  });

  it("sempre soma o total, para qualquer combinação razoável", () => {
    for (const total of [10, 99.99, 1000, 1234.56, 0.03]) {
      for (const count of [2, 3, 5, 7, 12, 24]) {
        const parts = splitInstallments(total, count);
        expect(parts).toHaveLength(count);
        expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 8);
      }
    }
  });

  it("count inválido não quebra", () => {
    expect(splitInstallments(100, 1)).toEqual([100]);
    expect(splitInstallments(100, 0)).toEqual([100]);
  });
});
