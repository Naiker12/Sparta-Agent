# Composer folder ownership

The composer previously read the global active thread and could display a
persisted draft folder as fallback inside a saved chat. Loading the chip also
called `ensureThreadWorkspace`, which could consume that pending folder and
bind it to the saved chat.

- The chip now reads its owning assistant-ui runtime (or an explicit pane ID).
- Opening a saved chat only reads its saved workspace. Pending folders are
  visible only in the primary draft. Returning to a draft reloads its selection.
- Newly initialized primary threads capture their pending folder explicitly.
  Sending preserves an existing binding and only consumes a captured selection
  for that new thread. In-flight binding requests are isolated by thread.
- Capturing a folder does not let its eventual completion clear a newer draft
  selection. Saved-chat disconnects also preserve unrelated draft selections.
- Git status is keyed by scope and path; a previous folder's branch cannot
  flash under the next folder. Late connection/disconnection results cannot
  change the newly selected chat's displayed binding or active project.

TypeScript passed. Browser tests with simulated backends verify distinct pdf,
alpha and beta folders despite an unrelated AUTEM draft; no workspace writes
occur when opening or sending those saved chats. They also verify that an
unclaimed chat inherits no folder, a newly claimed draft receives its captured
folder, and a later draft selection survives. Existing panel tests passed.

This change prevents cross-chat reassignment. It does not silently rewrite
bindings that may already have been saved incorrectly by an earlier version.
