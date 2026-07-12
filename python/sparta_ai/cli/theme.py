"""
Centralized color palette for Sparta CLI.

Minimalist 3-role palette inspired by OpenCode's "boring, inspectable, fast" ethos:
  - ACCENT: single gold accent for important values
  - ACCENT_DIM: muted bronze for borders/secondary labels
  - MUTED: warm gray for timestamps, metadata, supporting text
"""

# Sparta palette — reduced to 3 roles (v2 redesign)
ACCENT = "#D9A441"      # gold — titles, important values, key labels
ACCENT_DIM = "#8A6D3B"  # muted bronze — borders, secondary labels
MUTED = "#7A7570"       # warm gray — timestamps, metadata, supporting text

# Semantic aliases
OK = "green"
WARNING = "yellow"
ERROR = "red"
INFO = "cyan"
DIM = "dim"

# Backward-compatible aliases for logo.py and any other legacy imports
BRONZE = ACCENT_DIM
GOLD_DARK = ACCENT
GOLD = ACCENT
GOLD_MUTED = ACCENT_DIM
SUCCESS = OK
ERROR = ERROR
