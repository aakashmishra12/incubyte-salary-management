/**
 * A check on the one thing the instructions ask of the model that code cannot force:
 * to copy figures from the tools and never work them out. After an answer is written, every
 * figure in it is looked up in the data the answer was allowed to use. A figure that is not
 * there was invented, rounded or calculated by the model, and is reported so the reader can
 * be warned.
 */

// A figure is digits, optionally with thousands commas and a decimal part: 9,598 or 41.3.
const FIGURE = /\d[\d,]*(?:\.\d+)?/g;

/** 9,598 and 9598 are the same figure, and so are 41.30 and 41.3. */
function normalise(figure: string): string {
  const plain = figure.replace(/,/g, '');
  return plain.includes('.') ? plain.replace(/0+$/, '').replace(/\.$/, '') : plain;
}

function figuresIn(text: string): string[] {
  return (text.match(FIGURE) ?? []).map(normalise);
}

/**
 * The figures in `answer` that appear nowhere in `evidence`, each once, in order.
 * `evidence` is everything the answer may legitimately use: the tool results, the question and
 * the conversation so far. Small whole numbers (one or two digits) are ignored, because they are
 * counts and list positions ("top 5", "2.") and not salary figures, and the data would only
 * contain them by chance.
 */
export function findUngroundedFigures(answer: string, evidence: readonly string[]): string[] {
  const known = new Set(evidence.flatMap(figuresIn));
  const ungrounded: string[] = [];

  for (const figure of figuresIn(answer)) {
    const isSmallWholeNumber = !figure.includes('.') && figure.length <= 2;
    if (isSmallWholeNumber || known.has(figure) || ungrounded.includes(figure)) continue;
    ungrounded.push(figure);
  }
  return ungrounded;
}
