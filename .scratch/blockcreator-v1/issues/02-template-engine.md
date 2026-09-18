# Template engine (Mustache subset) in `core/template`

Status: done
Blocked by: 01
Spec: ../spec.md

Implement the Piece template renderer per the spec: `{{param}}`, `{{#if}}...{{else}}...{{/if}}`, `{{#each}}`, `{{label "name"}}` (unique per Piece instance via an injected label factory), `{{false}}` (Condition false-target), hex / signed-byte helpers. No JavaScript evaluation.

**Done when**
- Unit tests cover every construct, nesting, unknown param (clear error), and label uniqueness across two instances.
