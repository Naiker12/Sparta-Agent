"""Provision voice into the same writable data home as the desktop backend."""
import argparse
import os
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', required=True)
    args = parser.parse_args()
    os.environ['UNSLOTH_STUDIO_HOME'] = str(Path(args.home).resolve())
    from core.inference.voice_setup import configure
    configure()

if __name__ == '__main__':
    main()
