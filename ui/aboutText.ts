// What the About dialog says: who made the tool, where its knowledge of the game comes from and
// what it needs or is built with. Kept apart from the component so it is easy to keep up to date.

export interface AboutLink {
  label: string;
  url: string;
}

export const ABOUT = {
  summary: 'A visual editor for Super Mario World custom blocks (GPS).',
  author: 'Saphros',
  website: { label: 'saphros.de', url: 'https://saphros.de' },
  knowledgeSource: {
    label: 'Super Mario World disassembly (SMWDisX)',
    url: 'https://github.com/IsoFrieze/SMWDisX',
  },
  /** Software the user has to have; BlockCreator does not ship it. */
  needs: 'GPS · asar.dll from your GPS folder (not included) · Edge WebView2',
  builtWith: 'Blockly · Tauri · React · Ajv',
  notice: 'Super Mario World is a trademark of Nintendo. BlockCreator is an unofficial fan tool.',
} satisfies {
  summary: string;
  author: string;
  website: AboutLink;
  knowledgeSource: AboutLink;
  needs: string;
  builtWith: string;
  notice: string;
};
