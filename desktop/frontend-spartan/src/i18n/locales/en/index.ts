import { ui } from "./ui.ts";
import { apiPage } from "./api-page.ts";
import { audioPage } from "./audio-page.ts";
import { chat } from "./chat.ts";
import { channels } from "./channels.ts";
import { common } from "./common.ts";
import { exportPage } from "./export-page.ts";
import { hub } from "./hub.ts";
import { images } from "./images.ts";
import { picker } from "./picker.ts";
import { projectsPage } from "./projects-page.ts";
import { runSettings } from "./run-settings.ts";
import { settings } from "./settings/index.ts";
import { shell } from "./shell.ts";
import { studio } from "./studio/index.ts";
import { tour } from "./tour.ts";
import { update } from "./update.ts";

export const en = {
  channels,
  ui,
  audioPage,
  exportPage,
  hub,
  images,
  runSettings,
  picker,
  common,
  projectsPage,
  apiPage,
  shell,
  settings,
  studio,
  chat,
  update,
  tour,
} as const;
