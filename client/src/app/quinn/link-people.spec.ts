import { linkPeople, MentionedPerson } from './link-people';

describe('linkPeople', () => {
  const link = (id: string) => `/people/${id}`;
  const nancy: MentionedPerson = { name: 'Nancy Lynn Davolio', id: 'n1' };
  const nancyShort: MentionedPerson = { name: 'Nancy Davolio', id: 'n1' };
  const janeDoe: MentionedPerson = { name: 'Jane Doe', id: 'j1' };
  const janeMDoe: MentionedPerson = { name: 'Jane M Doe', id: 'j2' };

  it('links each name to the URL the caller builds', () => {
    expect(linkPeople('Ask **Jane Doe** or Jane M Doe.', [janeDoe, janeMDoe], link)).toBe(
      'Ask **[Jane Doe](/people/j1)** or [Jane M Doe](/people/j2).',
    );
  });

  it('prefers the longest name', () => {
    expect(linkPeople('Nancy Lynn Davolio and Nancy Davolio', [nancyShort, nancy], link)).toBe(
      '[Nancy Lynn Davolio](/people/n1) and [Nancy Davolio](/people/n1)',
    );
  });

  it('ignores case, and keeps the text as written', () => {
    expect(linkPeople('jane doe', [janeDoe], link)).toBe('[jane doe](/people/j1)');
  });

  it('matches whole words only, letters outside ASCII included', () => {
    const muller: MentionedPerson = { name: 'Arjun Müller', id: 'm1' };
    expect(linkPeople('Arjun Müllers and Arjun Müller', [muller], link)).toBe(
      'Arjun Müllers and [Arjun Müller](/people/m1)',
    );
  });

  it('leaves code and existing links alone', () => {
    const markdown = '`Jane Doe` and [Jane Doe](https://example.com) and\n```\nJane Doe\n```';
    expect(linkPeople(markdown, [janeDoe], link)).toBe(markdown);
  });

  it('links a name only once it is complete, for text still streaming in', () => {
    expect(linkPeople('Ask Jane D', [janeDoe], link)).toBe('Ask Jane D');
    expect(linkPeople('Ask Jane Doe', [janeDoe], link)).toBe('Ask [Jane Doe](/people/j1)');
  });

  it('escapes names that contain special characters', () => {
    const obrien: MentionedPerson = { name: "Liam O'Brien (Jr.)", id: 'o1' };
    expect(linkPeople("Liam O'Brien (Jr.) and Liam O'BrienX", [obrien], link)).toBe(
      "[Liam O'Brien (Jr.)](/people/o1) and Liam O'BrienX",
    );
  });

  it('returns the text unchanged without people', () => {
    expect(linkPeople('Jane Doe', [], link)).toBe('Jane Doe');
    expect(linkPeople('Jane Doe', undefined, link)).toBe('Jane Doe');
  });
});
