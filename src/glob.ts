import { type Dirent, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import ignore, { type Ignore } from 'ignore';
import { escapePath, glob } from 'tinyglobby';

export interface GlobOptions {
  cwd?: string;
  /** Honor .gitignore files (nested, plus parents up to the git root). */
  gitignore?: boolean;
  dot?: boolean;
  absolute?: boolean;
  onlyDirectories?: boolean;
  expandDirectories?: boolean;
  followSymbolicLinks?: boolean;
  ignore?: string[];
}

interface IgnoreScope {
  /** Absolute directory the .gitignore lives in. */
  directory: string;
  matcher: Ignore;
}

const toPosix = (p: string): string => p.split(path.sep).join('/');

function readScope(directory: string): IgnoreScope | undefined {
  try {
    const content = readFileSync(path.join(directory, '.gitignore'), 'utf8');
    return { directory, matcher: ignore().add(content) };
  } catch {
    return undefined;
  }
}

/** Walk up from cwd to the nearest directory containing `.git`. */
function findGitRoot(cwd: string): string | undefined {
  let current = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

const ALWAYS_SKIPPED_DIRS = new Set(['node_modules', '.git']);

function isInside(directory: string, target: string): string | undefined {
  const relative = path.relative(directory, target);
  if (
    relative === '' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return toPosix(relative);
}

/**
 * Whether `target` is ignored by the scopes that contain it. Deeper scopes
 * override shallower ones, so scopes must be ordered shallow to deep.
 */
function isIgnoredBy(
  target: string,
  scopes: IgnoreScope[],
  isDirectory: boolean,
): boolean {
  let ignored = false;
  for (const { directory, matcher } of scopes) {
    const relative = isInside(directory, target);
    if (relative !== undefined) {
      const result = matcher.test(isDirectory ? `${relative}/` : relative);
      if (result.ignored) {
        ignored = true;
      } else if (result.unignored) {
        ignored = false;
      }
    }
  }
  return ignored;
}

interface GitignoreWalk {
  /** Every .gitignore found in non-ignored directories, shallow to deep. */
  scopes: IgnoreScope[];
  /** Absolute paths of directories ignored by .gitignore (never descended). */
  prunedDirs: string[];
}

/**
 * Single manual walk from cwd. Loads each directory's .gitignore while
 * descending and never enters ignored directories, so a negation can't
 * re-include anything inside an already ignored directory (git semantics).
 * Symlinks are not followed; node_modules and .git are always skipped.
 */
async function walkGitignore(cwd: string): Promise<GitignoreWalk> {
  const scopes: IgnoreScope[] = [];
  const prunedDirectories: string[] = [];

  // Parent .gitignore files up to the git root (shallowest first).
  const gitRoot = findGitRoot(cwd);
  if (gitRoot !== undefined) {
    const parents: string[] = [];
    let current = cwd;
    while (current !== gitRoot) {
      current = path.dirname(current);
      parents.unshift(current);
    }
    for (const parent of parents) {
      const scope = readScope(parent);
      if (scope !== undefined) {
        scopes.push(scope);
      }
    }
  }

  async function visit(
    directory: string,
    inherited: IgnoreScope[],
  ): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    let active = inherited;
    if (entries.some((entry) => entry.name === '.gitignore')) {
      const scope = readScope(directory);
      if (scope !== undefined) {
        scopes.push(scope);
        active = [...inherited, scope];
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !ALWAYS_SKIPPED_DIRS.has(entry.name)) {
        const child = path.join(directory, entry.name);
        if (isIgnoredBy(child, active, true)) {
          prunedDirectories.push(child);
        } else {
          // Sequential on purpose: scopes must be collected shallow to deep.
          // eslint-disable-next-line no-await-in-loop
          await visit(child, active);
        }
      }
    }
  }

  await visit(cwd, [...scopes]);
  return { prunedDirs: prunedDirectories, scopes };
}

/**
 * Drop-in replacement for the subset of globby used by depsweep. Built on
 * tinyglobby + ignore so the dependency tree has no braces/micromatch.
 */
export async function globby(
  patterns: string[],
  options: GlobOptions = {},
): Promise<string[]> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const { gitignore, ...rest } = options;

  let walk: GitignoreWalk | undefined;
  let extraIgnore: string[] = [];
  if (gitignore === true) {
    walk = await walkGitignore(cwd);
    extraIgnore = walk.prunedDirs.flatMap((directory) => {
      const escaped = escapePath(toPosix(path.relative(cwd, directory)));
      return [escaped, `${escaped}/**`];
    });
  }

  const results = await glob(patterns, {
    ...rest,
    absolute: true,
    cwd,
    ignore: [...(rest.ignore ?? []), ...extraIgnore],
  });

  // tinyglobby returns directories with a trailing slash; globby did not.
  let files = results.map((file) =>
    file.length > 1 && file.endsWith('/') ? file.slice(0, -1) : file,
  );

  if (walk !== undefined && walk.scopes.length > 0) {
    const { scopes } = walk;
    files = files.filter(
      (file) =>
        !isIgnoredBy(
          path.resolve(file),
          scopes,
          Boolean(options.onlyDirectories),
        ),
    );
  }

  if (options.absolute === true) {
    return files;
  }
  // globby returned "." for cwd itself; path.relative yields "".
  return files.map((file) => {
    const relative = toPosix(path.relative(cwd, file));
    return relative === '' ? '.' : relative;
  });
}
