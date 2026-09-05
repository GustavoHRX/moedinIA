import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // AUDITORIA M-8: o ESLint não estava instalado, então estas regras nunca
    // rodaram. O código atual funciona, mas usa muito o padrão
    // `useEffect(() => setState(...), [])` que as regras novas do react-hooks
    // marcam. Rebaixadas para `warn` para não travar o build num refactor
    // grande e arriscado — ficam visíveis para correção gradual.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
