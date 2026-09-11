// eslint-disable-next-line import-x/no-extraneous-dependencies -- mikey-pro is a devDependency by design; config files are exempt
import mikeyPro from 'mikey-pro/eslint';

export default [
  ...mikeyPro,
  {
    // depsweep is a local CLI whose entire purpose is reading files discovered
    // by traversing the invoking user's own project tree — there is no privilege
    // boundary. An attacker who can influence these paths already has write access
    // to the scanned project, giving them equivalent capability via build scripts.
    files: ['src/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // src/index.ts is the CLI entry point; console output there IS the product
    // (scan results, JSON mode, progress reporting). Disabling only here avoids
    // masking stray debug logs in library-ish files.
    files: ['src/index.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // mikey-pro@10.3.4 hard-codes parser:'babel' in the prettier/prettier rule
    // for all files, causing "Parsing error" on TypeScript-specific syntax (import
    // type, satisfies, etc.). Fixed in mikey-pro@10.3.5; bump this override once
    // that version is published (npm view mikey-pro versions).
    files: ['src/**/*.ts'],
    rules: {
      'prettier/prettier': ['warn', { parser: 'typescript' }],
    },
  },
];
