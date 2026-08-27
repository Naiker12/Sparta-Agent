import type { en } from "../en/index.ts";
import type { DeepPartialMessageTree } from "../../types.ts";
import { audioPage } from "./audio-page.ts";
import { exportPage } from "./export-page.ts";
import { hub } from "./hub.ts";
import { images } from "./images.ts";
import { runSettings } from "./run-settings.ts";
import { picker } from "./picker.ts";
import { common } from "./common.ts";
import { projectsPage } from "./projects-page.ts";
import { apiPage } from "./api-page.ts";
import { shell } from "./shell.ts";
import { settings } from "./settings/index.ts";
import { studio } from "./studio/index.ts";
import { chat } from "./chat.ts";
import { update } from "./update.ts";
import { tour } from "./tour.ts";

export const es = {
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
} satisfies DeepPartialMessageTree<typeof en>;
