# `docs/design/mocks/`

Finished screen frames — the things audited against in the sub-phase 12.2
three-way inventory pass (mock / current code / gap). One row in
[DESIGN.md Section 3](../../../DESIGN.md#3-component-inventory) per
distinct visual element discovered here.

Naming: identify the screen and the orientation. Examples:

```
globe-portrait.png
stream-view-portrait.png
profile-portrait.png
dashboard-portrait.png
auth-login-portrait.png
```

PNG or SVG both fine. Drop in batches as you finish frames; the inventory
pass runs per-batch rather than waiting for the full set.

For mood-board imagery, type specimens, color references, inspiration
shots, and reference photography — those go in
[../references/](../references/) and are not audited against.
