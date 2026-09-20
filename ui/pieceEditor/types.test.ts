import { describe, expect, it } from 'vitest';
import { loadPiece } from '../../core/library';
import {
  formDataToManifest,
  frequencyFlags,
  frequencyOf,
  initialFormData,
  manifestToFormData,
  type PieceFormData,
} from './types';

describe('Piece editor converters and validation', () => {
  it('converts initial action form data to valid manifest and passes loadPiece validation', () => {
    const data = initialFormData('action', 'TestAuthor');
    const manifest = formDataToManifest(data);
    expect(manifest.kind).toBe('action');
    expect(manifest.author).toBe('TestAuthor');
    expect(manifest.id).toBe('my_action');

    const result = loadPiece(JSON.stringify(manifest), data.template, 'actions', manifest.id);
    expect('errors' in result).toBe(false);
    if ('manifest' in result) {
      expect(result.manifest.id).toBe('my_action');
      expect(result.manifest.kind).toBe('action');
    }
  });

  it('converts initial condition form data to valid manifest and passes loadPiece validation', () => {
    const data = initialFormData('condition', 'TestAuthor');
    const manifest = formDataToManifest(data);
    expect(manifest.kind).toBe('condition');
    expect(manifest.id).toBe('c_my_check');

    const result = loadPiece(JSON.stringify(manifest), data.template, 'conditions', manifest.id);
    expect('errors' in result).toBe(false);
    if ('manifest' in result) {
      expect(result.manifest.id).toBe('c_my_check');
      expect(result.manifest.kind).toBe('condition');
    }
  });

  it('round-trips custom piece through manifestToFormData and formDataToManifest', () => {
    const data: PieceFormData = {
      kind: 'action',
      id: 'give_powerup',
      name: 'Give Super Mushroom',
      category: 'physics',
      customCategory: '',
      description: 'Gives the player a mushroom powerup',
      author: 'Creator',
      credits: 'Vanilla SMW',
      slots: 'mario',
      clobbersA: true,
      clobbersX: false,
      clobbersY: false,
      once: true,
      removesBlock: true,
      routines: 'bc_custom_routine',
      params: [
        {
          name: 'item_type',
          label: 'Item Type',
          type: 'enum',
          default: 'mushroom',
          options: [
            { value: 'mushroom', label: 'Mushroom' },
            { value: 'feather', label: 'Feather' },
          ],
        },
      ],
      template: 'LDA #$02\nSTA $19|!addr\n',
    };

    const manifest = formDataToManifest(data);
    const backToForm = manifestToFormData(manifest, data.template);
    expect(backToForm.id).toBe(data.id);
    expect(backToForm.name).toBe(data.name);
    expect(backToForm.author).toBe(data.author);
    expect(backToForm.once).toBe(true);
    expect(backToForm.removesBlock).toBe(true);
    expect(backToForm.routines).toBe('bc_custom_routine');
    expect(backToForm.params).toHaveLength(1);

    const result = loadPiece(JSON.stringify(manifest), data.template, 'actions', manifest.id);
    expect('errors' in result).toBe(false);
  });

  it('turns the once / removesBlock flags into one choice and back', () => {
    expect(frequencyOf({ once: false, removesBlock: false })).toBe('every');
    expect(frequencyOf({ once: true, removesBlock: false })).toBe('once');
    expect(frequencyOf({ once: true, removesBlock: true })).toBe('removes');
    expect(frequencyOf({ once: false, removesBlock: true })).toBe('removes');

    expect(frequencyFlags('every')).toEqual({ once: false, removesBlock: false });
    expect(frequencyFlags('once')).toEqual({ once: true, removesBlock: false });
    // The same flags the built-in Erase block / Shatter / Change to tile Pieces have.
    expect(frequencyFlags('removes')).toEqual({ once: true, removesBlock: true });
  });

  it('detects invalid template syntax or schema errors via loadPiece', () => {
    const data = initialFormData('condition', 'Author');
    // Deliberately broken template: unclosed tag
    data.template = 'LDA $14AF\nBEQ {{unknown_tag\n';
    const manifest = formDataToManifest(data);

    const result = loadPiece(JSON.stringify(manifest), data.template, 'conditions', manifest.id);
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
