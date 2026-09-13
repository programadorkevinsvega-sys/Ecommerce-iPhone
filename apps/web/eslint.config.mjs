import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default defineConfig([
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: "Do not use dangerouslySetInnerHTML in the frontend.",
        },
        {
          selector: 'MemberExpression[property.name="innerHTML"]',
          message: "Do not write to innerHTML; use React rendering APIs.",
        },
        {
          selector: 'MemberExpression[property.name="outerHTML"]',
          message: "Do not write to outerHTML; use React rendering APIs.",
        },
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: "Do not use insertAdjacentHTML; use React rendering APIs.",
        },
        {
          selector: 'CallExpression[callee.object.name="document"][callee.property.name="write"]',
          message: "Do not use document.write in the frontend.",
        },
        {
          selector: 'MemberExpression[object.name="localStorage"]',
          message: "Do not persist application data in localStorage.",
        },
        {
          selector: 'MemberExpression[object.name="sessionStorage"]',
          message: "Do not persist application data in sessionStorage.",
        },
        {
          selector: 'MemberExpression[object.name="indexedDB"]',
          message: "Do not persist application data in IndexedDB.",
        },
        {
          selector: 'AssignmentExpression[left.object.name="window"]',
          message: "Do not expose application secrets or sensitive data through window globals.",
        }
      ],
    },
  },
  globalIgnores([".next/**", ".open-next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
