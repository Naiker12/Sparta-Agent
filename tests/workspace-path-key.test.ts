import { expect, it } from "vitest";
import { workspacePathKey } from "../desktop/frontend-spartan/src/features/chat/utils/workspace-path-key";

it("reuses Windows folder groups across case and separator differences", () => {
  expect(workspacePathKey("D:\\Trabajo\\Infografias\\")).toBe(workspacePathKey("d:/trabajo/infografias"));
});
it("matches UNC paths without changing POSIX case sensitivity", () => {
  expect(workspacePathKey("\\\\SERVER\\Work\\")).toBe(workspacePathKey("//server/work"));
  expect(workspacePathKey("/work/Project")).not.toBe(workspacePathKey("/work/project"));
});
