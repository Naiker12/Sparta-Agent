
"""Build-stamped Unsloth release metadata.

Release builds may rewrite this module in the build workspace before creating
Python artifacts. Keep the committed value neutral so source checkouts do not
accidentally report a stale release tag.
"""

STUDIO_RELEASE_VERSION = None
