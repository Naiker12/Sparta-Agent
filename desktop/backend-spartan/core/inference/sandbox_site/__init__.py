
# Package marker only, so wheel builds ship this directory. It goes on the
# sandbox PYTHONPATH so site machinery imports the sibling ``sitecustomize`` at
# startup; nothing in the backend imports it directly.
