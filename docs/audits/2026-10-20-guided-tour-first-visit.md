# First-visit guided tour

The chat tour now opens automatically on the first active, settings-hydrated
chat visit in the browser/desktop profile. A stable local key records `shown`
immediately, so quitting or reloading mid-tour does not trigger it again.
Skipping and finishing record their respective state. The user-menu Guided
Tour command always allows a manual restart. Updates do not change this key.
Storage failures fall back to remembering it for the running session.

The tour has 12 localized steps: welcome, navigation, projects, API model,
folder/Git, permissions, search/research, attachments/tools, independent panels,
collapsed activity, visual responses/forms, and getting started. The obsolete
local-model description was replaced. The tour no longer enters comparison
mode or changes the conversation; steps only explain the interface.

Targets were added to existing controls. Lookup ignores hidden duplicate
targets, and missing targets receive a centered explanation rather than a stale
card position. Card clipping was corrected: decorative overflow cannot become
a programmatic scroll area, while long content has its own scrollable region.

Validation: TypeScript and locale parity passed; two history tests passed.
The real tour component/controller passed a browser fixture covering first
visit, reload mid-tour, manual restart, skip, completion of all 12 steps,
Escape, narrow viewport and missing targets. The final card was visually
inspected. The fixture does not exercise the full signed-in desktop startup.
