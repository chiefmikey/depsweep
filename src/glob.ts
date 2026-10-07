import * as fsSync from "node:fs";
import path from "node:path";

import ignore, { type Ignore } from "ignore";
import { glob } from "tinyglobby";

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

/** Gitignore scopes ordered shallow to deep so deeper files override. */
async function collectScopes(cwd: string): Promise<IgnoreScope[]> {
  const scopes: IgnoreScope[] = [];

  const gitRoot = findGitRoot(cwd);
  if (gitRoot) {
    const parents: string[] = [];
    let current = path.resolve(cwd);
    while (current !== gitRoot) {
      current = path.dirname(current);
      parents.unshift(current);
    }
    for (const dir of parents) {
      const scope = readScope(dir);
      if (scope) scopes.push(scope);
    }
  }

  const nested = await glob(["**/.gitignore"], {
    cwd,
    dot: true,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.git/**"],
  });
  const dirs = nested
    .map((file) => path.dirname(file))
    .sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  for (const dir of dirs) {
    const scope = readScope(dir);
    if (scope) scopes.push(scope);
  }

  return scopes;
}

function isGitIgnored(absolutePath: string, scopes: IgnoreScope[]): boolean {
  let ignored = false;
  for (const { dir, matcher } of scopes) {
    const relative = path.relative(dir, absolutePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }
    const result = matcher.test(toPosix(relative));
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
  }
  return ignored;
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

  const results = await glob(patterns, {
    ...rest,
    cwd,
    absolute: true,
  });

  // tinyglobby returns directories with a trailing slash; globby did not.
  let files = results.map((file) =>
    file.length > 1 && file.endsWith("/") ? file.slice(0, -1) : file,
  );

  if (gitignore) {
    const scopes = await collectScopes(cwd);
    if (scopes.length > 0) {
      files = files.filter((file) => !isGitIgnored(path.resolve(file), scopes));
    }
  }

  if (options.absolute) return files;
  return files.map((file) => toPosix(path.relative(cwd, file)));
}
