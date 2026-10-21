import { describe, expect, it } from "vitest";
import { gerarCsv } from "./csv";

describe("CSV", () => {
  it("usa ponto e vírgula, vírgula decimal e escapa aspas", () => {
    const c = gerarCsv(["a", "b"], [[1.5, 'x;"y"'], [new Date(Date.UTC(2026, 1, 9)), null]]);
    expect(c).toBe('﻿a;b\r\n1,5;"x;""y"""\r\n09/02/2026;');
  });
});
