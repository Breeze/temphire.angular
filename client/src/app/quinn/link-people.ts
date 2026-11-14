/** A name in Quinn's answer and the staffing resource it stands for, as the server reports them. */
export interface MentionedPerson {
  readonly name: string;
  readonly id: string;
}

/**
 * Turns each name in `people` that occurs in `markdown` into a Markdown link, `[name](linkFor(id))`,
 * leaving code and existing links alone.
 *
 * The server says which names stand for which people (it worked that out from the tool results:
 * full names, unambiguous short forms); what a link to a person looks like is up to the client, so
 * the URL comes from `linkFor`.
 *
 * - Longer names win, so "Nancy Lynn Davolio" is one link, not "Nancy Davolio" plus a stray word.
 * - Names match whole words only and ignore case; letters outside ASCII count as letters, so
 *   "Müller" is not matched inside "Müllers".
 * - A name inside a code block, a code span, a link or an image is left as it is.
 *
 * Safe to call on text that is still streaming in: a name split across two pieces simply becomes
 * a link once the rest of it arrives.
 */
export function linkPeople(
  markdown: string,
  people: readonly MentionedPerson[] | null | undefined,
  linkFor: (id: string) => string,
): string {
  if (!markdown || !people?.length) {
    return markdown;
  }

  const ids = new Map(people.map((person) => [person.name.toLowerCase(), person.id]));
  const names = [...ids.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const namePattern = new RegExp(
    `(?<![\\p{L}\\p{N}_\\[])(?:${names.join('|')})(?![\\p{L}\\p{N}_\\]])`,
    'giu',
  );
  const link = (text: string) =>
    text.replace(namePattern, (name) => {
      const id = ids.get(name.toLowerCase());
      return id ? `[${name}](${linkFor(id)})` : name;
    });

  // Link names in the plain text between the protected pieces: code blocks, code spans, links and
  // images.
  const protectedPattern = /```[\s\S]*?```|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)/g;
  let result = '';
  let position = 0;
  for (const match of markdown.matchAll(protectedPattern)) {
    result += link(markdown.slice(position, match.index)) + match[0];
    position = match.index + match[0].length;
  }
  return result + link(markdown.slice(position));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
