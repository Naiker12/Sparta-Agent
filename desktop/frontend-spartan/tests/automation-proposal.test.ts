import assert from "node:assert/strict";
import test from "node:test";
import { readAutomationProposal } from "../src/features/tasks/automation-proposal";

test("saved tool plan restores editable options without model-supplied privileges", () => {
  const plan = readAutomationProposal(JSON.stringify({kind:"automation_proposal", plan:{title:"Report",prompt:"Research",scheduleType:"weekly",weekdays:[0,2],localTime:"09:00",timezone:"America/Bogota",webAccess:true,workspaceAccess:"write",projectId:"private"}}));
  assert.deepEqual(plan?.weekdays,[0,2]);
  assert.equal(plan?.webAccess,true);
  assert.equal("workspaceAccess" in plan!,false);
  assert.equal("projectId" in plan!,false);
});
test("invalid saved plan cannot crash the chat renderer", () => {
  for (const change of [{timezone:"invalid/zone"},{weekdays:[99]},{weekdays:"Monday"},{scheduleType:"invalid"},{runAt:"tomorrow"},{localTime:"25:99"}]) {
    assert.equal(readAutomationProposal({kind:"automation_proposal",plan:{title:"Report",prompt:"Research",...change}}),null);
  }
  assert.equal(readAutomationProposal("incomplete JSON"),null);
});
