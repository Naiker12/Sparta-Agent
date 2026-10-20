# Tool activity and empty protocol output

The reported screenshots show successful-looking tool cards followed by empty
`<tool_call>` envelopes in assistant text. They do not establish which files
were moved. Investigation and tests perform no user file operations.

## Findings

- Studio's streaming healer becomes dormant after structured tool calls; text
  then passes through verbatim. Empty envelopes are not executable calls.
- Studio already has call budgets, duplicate detection and fruitless-turn
  limits. This change does not replace those or infer an unbounded execution
  loop from the screenshots.
- Live output previously forced a whole tool group open throughout a turn.
- Reasoning rows had 28px of combined vertical margins.

## Changes

- The assistant Markdown display removes only unindented lines consisting of
  empty tool-call markers, and only in messages containing actual tool parts.
  Fence contents, inline mentions, populated calls and raw stored messages stay
  intact. Partial trailing markers are suppressed while streaming.
  Context copies also remove this debris before tool parts become inert text.
- If a Studio provider ends a turn with only empty envelopes, it stops with an
  explicit diagnostic instead of presenting that output as a successful answer.
  It does not retry or invent file operations. Previous results remain visible.
- Activity groups stay collapsed until opened, including failed operations.
  Pending approval prompts remain visible until answered.
  Live tools animate the group indicator without falsely saying they search.
- Reduced row spacing, smaller reasoning margins, bounded expanded lists,
  localized fallback labels and subtle entry animation. Approval groups have
  no height cap. Collapse transitions respect reduced-motion preferences.
- OpenUI panels remain outside generic tool groups; no dependency upgrade.

## References

- https://www.assistant-ui.com/docs/guides/part-grouping
- https://www.assistant-ui.com/elements/tool-group
- https://www.openui.com/docs/openui-lang/overview

OpenUI renders approved component schemas; it does not replace tool execution
or the chat's activity lifecycle. There is no claim here that ChatGPT uses this
third-party library internally.

## Validation

- Backend Studio loop suite: 32 tests passed.
- Display sanitizer: 3 tests passed, including split tokens and code examples.
- Frontend TypeScript and locale parity passed.
- Browser fixture checks tool-group opening/closing and removal of leaked
  markers, alongside independent panel lifecycle and send checks. Provider and
  backend responses are simulated; this is not a live-model file-moving test.

Remaining scope: nonempty malformed calls deliberately remain inspectable.
This display cleanup does not verify a model's claims about moved files or
convert arbitrary prose/code into actions.
