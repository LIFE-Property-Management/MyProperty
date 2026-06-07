#!/usr/bin/env python3
"""Format-preserving image-tag bumper for values-gjirafa.yaml (CD pipeline).

Invoked by .github/workflows/cd.yml to set per-component image tags without
reformatting the human-maintained values file. mikefarah `yq -i` re-serialises
the whole document (strips blank lines, normalises comment spacing); ruamel.yaml
round-trips byte-for-byte, so a tag bump is a true one-line diff.

Usage:
    bump_image_tags.py <values.yaml> <dotted.key=value> [<dotted.key=value> ...]

Example:
    bump_image_tags.py helm/myproperty/values-gjirafa.yaml \\
        backend.image.tag=1a2b3c4 migration.image.tag=1a2b3c4

Indent settings (mapping=2, sequence=4, offset=2) match the existing file so the
`ingress.tls.issuers` and `networkPolicies` sequences are not re-indented. Tag
values are wrapped as double-quoted scalars to preserve the `tag: "abc1234"`
style (a bare assignment would drop the quotes).
"""
from __future__ import annotations

import sys

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import DoubleQuotedScalarString


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2

    path = argv[1]
    assignments: list[tuple[list[str], str]] = []
    for raw in argv[2:]:
        if "=" not in raw:
            print(f"error: assignment must be key=value, got {raw!r}", file=sys.stderr)
            return 2
        dotted, value = raw.split("=", 1)
        keys = dotted.strip().lstrip(".").split(".")
        if not all(keys):
            print(f"error: malformed key path {dotted!r}", file=sys.stderr)
            return 2
        assignments.append((keys, value))

    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.indent(mapping=2, sequence=4, offset=2)

    with open(path) as fh:
        data = yaml.load(fh)

    for keys, value in assignments:
        node = data
        for key in keys[:-1]:
            node = node[key]  # KeyError here = a typo'd path; fail loudly.
        node[keys[-1]] = DoubleQuotedScalarString(value)

    with open(path, "w") as fh:
        yaml.dump(data, fh)

    print(
        f"Bumped {len(assignments)} tag(s) in {path}: "
        + ", ".join(".".join(keys) for keys, _ in assignments)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
