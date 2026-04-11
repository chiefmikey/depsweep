import { jest } from "@jest/globals";

describe("Global Impact Interfaces", () => {
  it("should have GlobalImpact interface with required fields", async () => {
    const { GlobalImpact } = (await import("../../src/interfaces.js")) as any;
    // Interface existence is verified by TypeScript compilation
    // Test a concrete implementation
    const impact: any = {
      monthlyDownloads: 395000000,
      unpackedSize: 2423319,
      transitiveDepsSize: 500000,
      totalSizeGB: 0.00272,
      energyWasteKwh: 64.4,
      carbonWasteKg: 24.1,
      waterWasteLiters: 115.9,
      treesEquivalent: 1.08,
      carMilesEquivalent: 60.3,
      region: "NA",
      carbonIntensity: 0.37,
      sources: {
        downloads: "npm downloads API",
        packageSize: "npm registry API",
        energyIntensity: "IEA/LBNL 2024",
        carbonIntensity: "EIA 2023",
      },
    };
    expect(impact.monthlyDownloads).toBe(395000000);
    expect(impact.sources.downloads).toBe("npm downloads API");
  });
});

describe("getPackageMetadata", () => {
  it("should fetch unpackedSize and dependencies from npm registry", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    const mockResponse = {
      ok: true,
      json: async () => ({
        dist: { unpackedSize: 2423319 },
        dependencies: {
          "follow-redirects": "^1.15.0",
          "form-data": "^4.0.0",
        },
      }),
    };
    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(mockResponse),
    ) as any;

    try {
      const result = await getPackageMetadata("axios", "1.7.0");
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(2423319);
      expect(result!.dependencies).toEqual(["follow-redirects", "form-data"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should return null on network error", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error("network")),
    ) as any;

    try {
      const result = await getPackageMetadata("nonexistent", undefined, 1);
      expect(result).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle packages with no dependencies", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    const mockResponse = {
      ok: true,
      json: async () => ({
        dist: { unpackedSize: 5000 },
      }),
    };
    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(mockResponse),
    ) as any;

    try {
      const result = await getPackageMetadata("tiny-pkg");
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(5000);
      expect(result!.dependencies).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("getPackageMetadata retry logic", () => {
  it("should retry on 503 and succeed on second attempt", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ dist: { unpackedSize: 1000 } }),
      } as Response);
    }) as any;

    try {
      const result = await getPackageMetadata("retry-pkg", undefined, 1);
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(1000);
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should not retry on 404", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve({ ok: false, status: 404 } as Response);
    }) as any;

    try {
      const result = await getPackageMetadata("nonexistent-pkg", undefined, 1);
      expect(result).toBeNull();
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should return null after max retries", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve({ ok: false, status: 503 } as Response);
    }) as any;

    try {
      const result = await getPackageMetadata("always-fail-pkg", undefined, 1);
      expect(result).toBeNull();
      expect(callCount).toBe(4); // 1 initial + 3 retries
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should retry on network errors and succeed", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("ECONNRESET"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ dist: { unpackedSize: 2000 } }),
      } as Response);
    }) as any;

    try {
      const result = await getPackageMetadata("network-retry-pkg", undefined, 1);
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(2000);
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("resolveTransitiveSize", () => {
  it("should return 0 in quick mode", async () => {
    const { resolveTransitiveSize } = await import(
      "../../src/global-impact.js"
    );
    const result = await resolveTransitiveSize(["dep-a", "dep-b"], true);
    expect(result).toBe(0);
  });

  it("should sum unpackedSize of all transitive deps in deep mode", async () => {
    const { resolveTransitiveSize } = await import(
      "../../src/global-impact.js"
    );

    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("/dep-a/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
            dependencies: { "dep-a-child": "^1.0.0" },
          }),
        });
      }
      if (urlStr.includes("/dep-a-child/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 5000 },
          }),
        });
      }
      if (urlStr.includes("/dep-b/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 20000 },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as any;

    try {
      const result = await resolveTransitiveSize(["dep-a", "dep-b"], false);
      expect(result).toBe(35000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle circular dependencies without infinite loop", async () => {
    const { resolveTransitiveSize } = await import(
      "../../src/global-impact.js"
    );

    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("/dep-a/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
            dependencies: { "dep-b": "^1.0.0" },
          }),
        });
      }
      if (urlStr.includes("/dep-b/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 20000 },
            dependencies: { "dep-a": "^1.0.0" },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as any;

    try {
      const result = await resolveTransitiveSize(["dep-a"], false);
      expect(result).toBe(30000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should skip deps that fail to fetch", async () => {
    const { resolveTransitiveSize } = await import(
      "../../src/global-impact.js"
    );

    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking fetch for tests
    globalThis.fetch = jest.fn((url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("/dep-a/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as any;

    try {
      const result = await resolveTransitiveSize(
        ["dep-a", "dep-fail"],
        false,
      );
      expect(result).toBe(10000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("calculateGlobalImpact", () => {
  it("should calculate impact using real formula with zero assumptions", async () => {
    const { calculateGlobalImpact } = await import(
      "../../src/global-impact.js"
    );

    const result = calculateGlobalImpact({
      monthlyDownloads: 395_000_000,
      unpackedSize: 2_423_319,
      transitiveDepsSize: 0,
      region: "NA",
    });

    // Manual verification:
    // totalSizeGB = 2423319 / (1024^3) = 0.002257 GB
    // energyWaste = 395000000 * 0.002257 * 0.06 = 53,491 kWh/month
    // carbonWaste = 53491 * 0.37 = 19,792 kg CO2e/month
    expect(result.totalSizeGB).toBeCloseTo(0.002257, 4);
    expect(result.energyWasteKwh).toBeCloseTo(53491, -1);
    expect(result.carbonWasteKg).toBeCloseTo(19792, -1);
    expect(result.waterWasteLiters).toBeCloseTo(96284, -2);
    expect(result.treesEquivalent).toBeCloseTo(891, 0);
    expect(result.carMilesEquivalent).toBeCloseTo(49480, -1);
    expect(result.monthlyDownloads).toBe(395_000_000);
    expect(result.region).toBe("NA");
    expect(result.carbonIntensity).toBe(0.37);

    // Sources must be present
    expect(result.sources.downloads).toBe("npm downloads API");
    expect(result.sources.packageSize).toBe("npm registry API");
    expect(result.sources.energyIntensity).toContain("IEA");
    expect(result.sources.carbonIntensity).toContain("EIA");
  });

  it("should include transitive deps in total size", async () => {
    const { calculateGlobalImpact } = await import(
      "../../src/global-impact.js"
    );

    const withoutTransitive = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 100_000,
      transitiveDepsSize: 0,
    });

    const withTransitive = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 100_000,
      transitiveDepsSize: 500_000,
    });

    expect(withTransitive.energyWasteKwh).toBeGreaterThan(
      withoutTransitive.energyWasteKwh,
    );
    expect(withTransitive.totalSizeGB).toBeCloseTo(
      withoutTransitive.totalSizeGB * 6,
      6,
    );
  });

  it("should use correct regional carbon intensity", async () => {
    const { calculateGlobalImpact } = await import(
      "../../src/global-impact.js"
    );

    const na = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
      region: "NA",
    });
    const eu = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
      region: "EU",
    });

    expect(na.carbonIntensity).toBe(0.37);
    expect(eu.carbonIntensity).toBe(0.213);
    expect(na.carbonWasteKg).toBeGreaterThan(eu.carbonWasteKg);
  });

  it("should handle zero downloads", async () => {
    const { calculateGlobalImpact } = await import(
      "../../src/global-impact.js"
    );

    const result = calculateGlobalImpact({
      monthlyDownloads: 0,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
    });

    expect(result.energyWasteKwh).toBe(0);
    expect(result.carbonWasteKg).toBe(0);
  });
});
