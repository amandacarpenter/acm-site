"""Offline failure fixture only; never shipped with production workers."""
import json
import sys
if sys.argv[1] == "inspect":
    print(json.dumps({"pages": 61}))
else:
    print(json.dumps({"error": "Deliberate offline processing failure"}), flush=True)
    sys.exit(1)
