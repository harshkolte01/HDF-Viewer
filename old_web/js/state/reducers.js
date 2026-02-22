import {
  getFiles,
  refreshFiles,
  getFileChildren,
  getFileMeta,
  getFilePreview,
} from "../api/hdf5Service.js";
import { getState, setState } from "./store.js";
import * as utils from "./reducers/utils.js";
import { createFileActions } from "./reducers/filesActions.js";
import { createTreeActions } from "./reducers/treeActions.js";
import { createViewActions } from "./reducers/viewActions.js";
import { createDisplayConfigActions } from "./reducers/displayConfigActions.js";
import { createDataActions } from "./reducers/dataActions.js";
import { createCompareActions } from "./reducers/compareActions.js";

export const actions = {};

const deps = {
  actions,
  getState,
  setState,
  api: {
    getFiles,
    refreshFiles,
    getFileChildren,
    getFileMeta,
    getFilePreview,
  },
  utils,
};

Object.assign(
  actions,
  createFileActions(deps),
  createTreeActions(deps),
  createViewActions(deps),
  createDisplayConfigActions(deps),
  createDataActions(deps),
  createCompareActions(deps)
);
