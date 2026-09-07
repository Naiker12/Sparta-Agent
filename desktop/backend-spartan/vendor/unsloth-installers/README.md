# Unsloth prebuilt installers

Source: https://github.com/unslothai/unsloth/tree/2e6db0c1289da4eefdb7d819ba6eb4523704a6a8/studio

Pinned upstream revision: `2e6db0c1289da4eefdb7d819ba6eb4523704a6a8`.
The Python files retain their upstream copyright and AGPL-3.0-only license;
see LICENSE.AGPL-3.0. These files are not covered by the root MIT license.

Local adaptation: the llama installer imports `utils.prebuilt.llama_backend`
instead of `backend.utils.prebuilt.llama_backend` to match Sparta's backend
module root. Entry points in the backend root run these files as scripts.
The Electron backend resource filter includes this directory and both entry
points. Installers are bundled, not downloaded as executable code at runtime.
