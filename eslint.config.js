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
    // index.ts is the CLI entry point; console output there is the product
    // (scan results, JSON mode, progress). Other files' console usage is
    // triaged individually, not blanket-disabled.
    files: ['src/index.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
