// eslint-disable-next-line import-x/no-extraneous-dependencies -- mikey-pro is a devDependency by design; config files are exempt
import mikeyPro from 'mikey-pro/eslint';

export default [
  ...mikeyPro,
  {
    // depsweep is a local CLI that reads files at paths it discovers itself
    // (getSourceFiles, dependency/config probing, transitive dep resolution)
    // by traversing the invoking user's own project tree. There is no
    // privilege boundary being crossed by a "non-literal" fs path here: an
    // attacker able to influence these paths would need pre-existing write
    // access to the project being scanned, at which point they already have
    // equivalent-or-greater capability via that project's own build/install
    // scripts. See docs/plans/2026-09-11-mikey-pro-lint-debt-cleanup.md.
    files: ['src/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // src/index.ts and src/cli-render.ts are CLI output; console output IS the product
    // (scan results, JSON mode, progress reporting). Disabling only here avoids
    // masking stray debug logs in library-ish files.
    files: ['src/index.ts', 'src/cli-render.ts'],
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
