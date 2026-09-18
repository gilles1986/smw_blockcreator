# Editor tracer bullet: sidebar Slot rows + Blockly + live ASM

Status: done
Blocked by: 04
Spec: ../spec.md

End-to-end slice in the real app: variant-C layout, Mario Slot rows (Top/Bottom/Inside), selecting a row loads its Blockly workspace, toolbox built from Library manifests (categories + colours, dark theme, zelos renderer), every change regenerates the ASM pane. Workspace <-> model adapter lives in `ui/`.

**Done when**
- Building the ON/OFF block by drag and drop shows the same ASM as the golden file from ticket 04.
- Switching Slots keeps each Slot's logic; the filled dot shows per row.
