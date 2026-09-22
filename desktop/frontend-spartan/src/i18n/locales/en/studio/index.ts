import { backToHistory } from "./backToHistory.ts";
import { charts } from "./charts.ts";
import { checkingSupport } from "./checkingSupport.ts";
import { datasetPicker } from "./dataset-picker.ts";
import { dataset } from "./dataset.ts";
import { goToImageTraining } from "./goToImageTraining.ts";
import { history } from "./history.ts";
import { imageTraining } from "./imageTraining.ts";
import { loadingRuntime } from "./loadingRuntime.ts";
import { methods } from "./methods.ts";
import { modelPicker } from "./model-picker.ts";
import { params } from "./params.ts";
import { preview } from "./preview.ts";
import { progress } from "./progress.ts";
import { routeTitle } from "./routeTitle.ts";
import { subtitles } from "./subtitles.ts";
import { tabs } from "./tabs.ts";
import { trainingStart } from "./training-start.ts";
import { training } from "./training.ts";
import { wizard } from "./wizard.ts";

export const studio = {
  routeTitle,
  wizard,
  preview,
  datasetPicker,
  modelPicker,
  methods,
  subtitles,
  tabs,
  imageTraining,
  goToImageTraining,
  loadingRuntime,
  checkingSupport,
  backToHistory,
  dataset,
  params,
  training,
  history,
  charts,
  progress,
  trainingStart,
};
