import React from "react";
import { createRoot } from "react-dom/client";
import { ChannelFiles } from "../../src/features/channels/components/channel-files";
import type { ChannelAccount } from "../../src/features/channels/types";
import { setLocale } from "../../src/i18n";
import "../../src/index.css";
await setLocale("es");
createRoot(document.getElementById("root")!).render(<ChannelFiles account={{id: "test-account", allowed_user_ids: ["123"]} as ChannelAccount} onError={() => {throw new Error("Unexpected generic channel error");}} />);
