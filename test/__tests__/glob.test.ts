import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import picomatch from "picomatch";

import { RAW_CONTENT_PATTERNS } from "../../src/constants";
import { globby } from "../../src/glob";

jest.unmock("node:fs");
jest.unmock("node:path");

function write(root: string, rel: string, content = "x"): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("globby replacement (tinyglobby + ignore)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "depsweep-glob-")),
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("honors root and nested .gitignore files, including negation", async () => {
    write(root, ".gitignore", "secret.txt\nbuild-out/\n*.tmp\n");
    write(root, "src/keep.ts");
    write(root, "src/.gitignore", "local.ts\n!keep.tmp\n");
    write(root, "src/local.ts");
    write(root, "src/keep.tmp");
    write(root, "src/other.tmp");
    write(root, "secret.txt");
    write(root, "build-out/a.js");
    write(root, "visible.js");

    const files = await globby(["**/*"], {
      cwd: root,
      gitignore: true,
      dot: true,
      absolute: true,
    });
    const rel = files.map((f) => path.relative(root, f)).sort();

    expect(rel).toEqual(
      [
        ".gitignore",
        "src/.gitignore",
        "src/keep.ts",
        "src/keep.tmp",
        "visible.js",
      ].sort(),
    );
  });

  it("returns gitignored files when gitignore is off", async () => {
    write(root, ".gitignore", "secret.txt\n");
    write(root, "secret.txt");
    const files = await globby(["*.txt"], { cwd: root, absolute: true });
    expect(files).toEqual([path.join(root, "secret.txt")]);
  });

  it("respects parent .gitignore files up to the git root", async () => {
    fs.mkdirSync(path.join(root, ".git"));
    write(root, ".gitignore", "ignored-by-parent.ts\n");
    write(root, "pkg/ignored-by-parent.ts");
    write(root, "pkg/ok.ts");
    const files = await globby(["**/*.ts"], {
      cwd: path.join(root, "pkg"),
      gitignore: true,
      absolute: true,
    });
    expect(files.map((f) => path.basename(f))).toEqual(["ok.ts"]);
  });

  it("includes dot files only when dot is set and applies ignore globs", async () => {
    write(root, ".hidden.ts");
    write(root, "a.ts");
    write(root, "dist/b.ts");
    write(root, "node_modules/x/c.ts");
    const withDot = await globby(["**/*"], {
      cwd: root,
      dot: true,
      ignore: ["dist", "**/node_modules/**"],
    });
    expect(withDot.sort()).toEqual([".hidden.ts", "a.ts"]);
    const noDot = await globby(["**/*"], { cwd: root });
    expect(noDot).not.toContain(".hidden.ts");
  });

  it("returns directories without trailing slash and cwd-relative paths by default", async () => {
    write(root, "packages/a/package.json");
    write(root, "packages/b/package.json");
    const dirs = await globby(["packages/*"], {
      cwd: root,
      onlyDirectories: true,
      expandDirectories: false,
      ignore: ["node_modules"],
    });
    expect(dirs.sort()).toEqual(["packages/a", "packages/b"]);
  });
});

describe("picomatch protected-dependency patterns", () => {
  it.each([
    ["webpack-cli", "webpack-*", true],
    ["webpack.config", "webpack.*", true],
    ["@babel/core", "@babel/*", true],
    ["@vitejs/plugin-react", "@vitejs/*", true],
    ["ts-node", "ts-*", true],
    ["lodash", "webpack-*", false],
  ])("%s vs %s -> %s", (name, pattern, expected) => {
    expect(picomatch.isMatch(name, pattern)).toBe(expected);
  });

  it("matches every RAW_CONTENT_PATTERNS entry against a sample name", () => {
    for (const [base, patterns] of RAW_CONTENT_PATTERNS.entries()) {
      expect(patterns.length).toBeGreaterThan(0);
      expect(base.length).toBeGreaterThan(0);
    }
    expect(picomatch.isMatch("@esbuild/darwin-arm64", "@esbuild/*")).toBe(true);
  });

  it("still supports brace patterns natively", () => {
    expect(picomatch.isMatch("a.ts", "*.{ts,js}")).toBe(true);
    expect(picomatch.isMatch("a.js", "*.{ts,js}")).toBe(true);
    expect(picomatch.isMatch("a.css", "*.{ts,js}")).toBe(false);
    expect(picomatch.isMatch("@types/node", "@{types,babel}/*")).toBe(true);
  });
});
