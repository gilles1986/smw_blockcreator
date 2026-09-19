// The dropdown of a sprite or sound number. Every number 00–FF is an option, so any value a Block
// holds loads; the numbers that have a name come first and read "04 · Green Koopa". Which names
// apply depends on another field of the block (the "custom" checkbox of a sprite, the port of a
// sound), so the field follows that field, and follows the app's name lists when they change.

import * as Blockly from 'blockly';
import { BUILT_IN_NAMES, nameChoices, type NameSource, type NamedNumber } from '../../core/names';
import { NAMES_FIELD_TYPE, type NamesFieldDefinition } from './fields';
import { createNamePicker } from './namePicker';

let source: NameSource = BUILT_IN_NAMES;

/** Where the names come from; the app swaps in one that has the PIXI sprites. */
export function setNameSource(next: NameSource): void {
  source = next;
}

type Options = Blockly.FieldDropdownFromJsonConfig & Partial<NamesFieldDefinition>;

export class NameField extends Blockly.FieldDropdown {
  private watching?: {
    workspace: Blockly.Workspace;
    listener: (e: Blockly.Events.Abstract) => void;
  };

  constructor(
    private readonly kind: 'sprite' | 'sound',
    private readonly listParam: string | undefined,
    value: string,
  ) {
    super(Blockly.Field.SKIP_SETUP);
    this.setOptions(() => this.options());
    this.setValue(value);
  }

  static override fromJson(options: Options): NameField {
    return new NameField(options.names ?? 'sprite', options.listParam, options.value ?? '00');
  }

  /** The numbers that have a name here: which list that is depends on the `listParam` field. */
  private namedNumbers(): readonly NamedNumber[] {
    const chosen: unknown =
      this.listParam === undefined
        ? undefined
        : this.getSourceBlock()?.getFieldValue(this.listParam);
    return this.kind === 'sprite'
      ? source.sprites(chosen === 'TRUE')
      : source.sounds(typeof chosen === 'string' ? chosen : '');
  }

  private options(): Blockly.MenuOption[] {
    const options: Blockly.MenuOption[] = [];
    for (const choice of nameChoices(this.namedNumbers())) {
      // A separator between the named numbers and the rest.
      if (
        !choice.named &&
        options.length > 0 &&
        options.at(-1) !== Blockly.FieldDropdown.SEPARATOR
      ) {
        options.push(Blockly.FieldDropdown.SEPARATOR);
      }
      options.push([choice.label, choice.value]);
    }
    return options;
  }

  /** Reads the names again, so the shown text is the one for the current value and lists. */
  private syncSelected(): void {
    this.getOptions(false);
    this.doValueUpdate_(this.getValue() as string);
  }

  /** Shows the name of the current number again, after the lists or the deciding field changed. */
  refresh(): void {
    this.syncSelected();
    this.forceRerender();
  }

  /** Opens the search dropdown instead of Blockly's plain menu: pick by name, or type a number. */
  protected override showEditor_(): void {
    const block = this.getSourceBlock();
    if (!block) return;
    const close = () => Blockly.DropDownDiv.hideIfOwner(this, true);
    const picker = createNamePicker(nameChoices(this.namedNumbers()), this.getValue(), {
      onPick: (value) => {
        close();
        this.setValue(value);
      },
      onCancel: close,
    });
    Blockly.DropDownDiv.clearContent();
    Blockly.DropDownDiv.getContentDiv().appendChild(picker.element);
    if (this.getConstants()?.FIELD_DROPDOWN_COLOURED_DIV) {
      const border = (block as Blockly.BlockSvg).getColourTertiary();
      Blockly.DropDownDiv.setColour(block.getColour(), border);
    }
    Blockly.DropDownDiv.showPositionedByField(this);
    // Focus goes in once the dropdown is placed; before that the page would scroll to fetch it.
    picker.focus();
  }

  override initView(): void {
    super.initView();
    // The block's other fields have their values by now.
    this.syncSelected();
  }

  override setSourceBlock(block: Blockly.Block): void {
    super.setSourceBlock(block);
    if (this.listParam === undefined) return;
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.BLOCK_CHANGE) return;
      const change = event as Blockly.Events.BlockChange;
      if (
        change.blockId === block.id &&
        change.element === 'field' &&
        change.name === this.listParam
      ) {
        this.refresh();
      }
    };
    block.workspace.addChangeListener(listener);
    this.watching = { workspace: block.workspace, listener };
  }

  override dispose(): void {
    if (this.watching) this.watching.workspace.removeChangeListener(this.watching.listener);
    super.dispose();
  }
}

/** Shows the names again in every name field of a workspace, e.g. once the PIXI sprites are read. */
export function refreshNameFields(workspace: Blockly.Workspace): void {
  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      for (const field of input.fieldRow) if (field instanceof NameField) field.refresh();
    }
  }
}

// Registered when this module loads, so anything that defines Piece blocks finds the field type.
Blockly.fieldRegistry.register(NAMES_FIELD_TYPE, NameField);
