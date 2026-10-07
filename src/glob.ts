import * as fsSync from "node:fs";
import * as fsPromises from "node:fs/promises";
import path from "node:path";

import ignore, { type Ignore } from "ignore";
import { escapePath, glob } from "tinyglobby";

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
  dir: string;
  matcher: Ignore;
}

const toPosix = (p: string): string => p.split(path.sep).join("/");

function readScope(dir: string): IgnoreScope | undefined {
  try {
    const content = fsSync.readFileSync(path.join(dir, ".gitignore"), "utf8");
    return { dir, matcher: ignore().add(content) };
  } catch {
    return undefined;
  }
}

/** Walk up from cwd to the nearest directory containing `.git`. */
function findGitRoot(cwd: string): string | undefined {
  let current = path.resolve(cwd);
  for (;;) {
    if (fsSync.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

const ALWAYS_SKIPPED_DIRS = new Set(["node_modules", ".git"]);

function isInside(dir: string, target: string): string | undefined {
  const relative = path.relative(dir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
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
  for (const { dir, matcher } of scopes) {
    const relative = isInside(dir, target);
    if (!relative) continue;
    const result = matcher.test(isDirectory ? `${relative}/` : relative);
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
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
  const prunedDirs: string[] = [];

  // Parent .gitignore files up to the git root (shallowest first).
  const gitRoot = findGitRoot(cwd);
  if (gitRoot) {
    const parents: string[] = [];
    let current = cwd;
    while (current !== gitRoot) {
      current = path.dirname(current);
      parents.unshift(current);
    }
    for (const dir of parents) {
      const scope = readScope(dir);
      if (scope) scopes.push(scope);
    }
  }

  async function visit(dir: string, inherited: IgnoreScope[]): Promise<void> {
    let entries: fsSync.Dirent[];
    try {
      entries = await fsPromises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    let active = inherited;
    if (entries.some((entry) => entry.name === ".gitignore")) {
      const scope = readScope(dir);
      if (scope) {
        scopes.push(scope);
        active = [...inherited, scope];
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || ALWAYS_SKIPPED_DIRS.has(entry.name)) {
        continue;
      }
      const child = path.join(dir, entry.name);
      if (isIgnoredBy(child, active, true)) {
        prunedDirs.push(child);
      } else {
        await visit(child, active);
      }
    }
  }

  await visit(cwd, [...scopes]);
  return { scopes, prunedDirs };
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
  if (gitignore) {
    walk = await walkGitignore(cwd);
    extraIgnore = walk.prunedDirs.flatMap((dir) => {
      const escaped = escapePath(toPosix(path.relative(cwd, dir)));
      return [escaped, `${escaped}/**`];
    });
  }

  const results = await glob(patterns, {
    ...rest,
    ignore: [...(rest.ignore ?? []), ...extraIgnore],
    cwd,
    absolute: true,
  });

  // tinyglobby returns directories with a trailing slash; globby did not.
  let files = results.map((file) =>
    file.length > 1 && file.endsWith("/") ? file.slice(0, -1) : file,
  );

  if (walk && walk.scopes.length > 0) {
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

  if (options.absolute) return files;
  // globby returned "." for cwd itself; path.relative yields "".
  return files.map((file) => toPosix(path.relative(cwd, file)) || ".");
}
