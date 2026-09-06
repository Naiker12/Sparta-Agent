"""Start the managed backend with a credential handed only to its parent pipe."""

import runpy
import sys
from pathlib import Path


def main():
    from auth.storage import create_desktop_secret

    # Electron captures this pipe; never forward this line to diagnostics/UI.
    print("SPARTA_DESKTOP_SECRET=" + create_desktop_secret(), flush = True)
    entrypoint = Path(__file__).with_name("run.py")
    sys.argv[0] = str(entrypoint)
    runpy.run_path(str(entrypoint), run_name = "__main__")


if __name__ == "__main__":
    main()
