import { describe, it, expect, beforeEach } from "vitest";
import { UserDirectoryStorageAdapter } from "../src/adapters/user-storage";
import { MockApplication, MockDocument } from "./mocks/indesign-mock";

describe("UserDirectoryStorageAdapter", () => {
  let adapter: UserDirectoryStorageAdapter;

  beforeEach(() => {
    adapter = new UserDirectoryStorageAdapter("dist/test-output");
  });

  it("writes and reads text files in memory/disk", () => {
    const filePath = "dist/test-output/test.txt";
    const content = "Hello QGDS Publishing Suite";

    expect(adapter.writeTextFile(filePath, content)).toBe(true);
    expect(adapter.exists(filePath)).toBe(true);
    expect(adapter.readTextFile(filePath)).toBe(content);
    expect(adapter.listFiles()).toContain("dist/test-output/test.txt");
  });

  it("resolves safe output directory alongside saved document", () => {
    const doc = new MockDocument();
    doc.saved = true;
    (doc as any).filePath = "C:/Work/Projects/AnnualReport";

    const dir = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(doc, "Deliverables");
    expect(dir).toBe("C:/Work/Projects/AnnualReport/Deliverables");
  });

  it("resolves safe output directory fallback for unsaved documents", () => {
    const doc = new MockDocument();
    doc.saved = false;

    const dir = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(doc, "Deliverables");
    expect(dir).toBeTruthy();
    expect(dir).toContain("Deliverables");
  });
});

