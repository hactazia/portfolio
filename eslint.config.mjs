import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "out/**",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "api/**",
      "scripts/**",
      // Vendored from the shadcn/ReactBits registry, kept as published.
      "src/components/StickerPeel.jsx",
    ],
  },
];

export default eslintConfig;
