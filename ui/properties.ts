// What is wrong with the Block's own properties, in words for the sidebar. The name is the name of
// the file, so it has to be one Windows can have; the default act as is a hex number.

import { fileName } from './blockDocument';
import { parseHex } from './hex';

export interface PropertyProblems {
  name?: string;
  defaultActAs?: string;
}

/** Problems with the name and with the act as text; a property that is fine is left out. */
export function propertyProblems(name: string, actAsText: string): PropertyProblems {
  const problems: PropertyProblems = {};
  const nameProblem = problemWithName(name);
  if (nameProblem) problems.name = nameProblem;
  const actAs = parseHex(actAsText);
  if (actAs === undefined) problems.defaultActAs = 'Not a hex number (like 130).';
  else if (actAs > 0xffff) problems.defaultActAs = 'At most FFFF.';
  return problems;
}

function problemWithName(name: string): string | undefined {
  if (name.trim() === '') return 'A Block needs a name: it is the name of its file.';
  const forbidden = [...new Set(name.match(/[\\/:*?"<>|]/g) ?? [])];
  if (forbidden.length > 0) {
    return `A file name cannot have ${forbidden.join(' ')}; they become _ (${fileName(name)}).`;
  }
  if (name.trimEnd().endsWith('.')) {
    return `Windows drops a dot at the end of a file name: ${name}`;
  }
  return undefined;
}
