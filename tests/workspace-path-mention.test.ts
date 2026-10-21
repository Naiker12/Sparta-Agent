import { describe, expect, it } from "vitest";
import {
  extractAbsoluteWorkspacePaths,
  hasUnconnectedWorkspacePath,
  pathIsInsideWorkspace,
} from "../desktop/frontend-spartan/src/features/chat/utils/workspace-path-mention";

describe("workspace path hints", () => {
  it("extracts a pasted Windows folder path without trailing prose punctuation", () => {
    expect(
      extractAbsoluteWorkspacePaths(
        "Crea los archivos en C:\\Users\\gomez\\Downloads\\test, por favor.",
      ),
    ).toEqual(["C:\\Users\\gomez\\Downloads\\test"]);
  });

  it("matches a file under the connected root with Windows path semantics", () => {
    expect(
      pathIsInsideWorkspace(
        "c:/users/Gomez/Downloads/test/index.html",
        "C:\\Users\\gomez\\Downloads\\test",
      ),
    ).toBe(true);
    expect(
      pathIsInsideWorkspace("C:\\Users\\gomez\\Downloads\\testing", "C:\\Users\\gomez\\Downloads\\test"),
    ).toBe(false);
  });

  it("requests a connection only when a mentioned path is outside this chat's workspace", () => {
    const message = "Guarda el HTML en C:\\Users\\gomez\\Downloads\\test\\index.html";
    expect(hasUnconnectedWorkspacePath(message)).toBe(true);
    expect(hasUnconnectedWorkspacePath(message, "D:\\sparta-agent")).toBe(true);
    expect(
      hasUnconnectedWorkspacePath(message, "C:\\Users\\gomez\\Downloads\\test"),
    ).toBe(false);
    expect(hasUnconnectedWorkspacePath("Crea una página HTML bonita.", undefined)).toBe(false);
  });
});
