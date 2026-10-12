// Marp-style slides parsing/preview (R-15). Slide separator: a line of ---.
// A leading front-matter block (--- … ---) is options and not rendered.

export function parseSlides(body) {
  const lines = String(body).split('\n');
  let i = 0;
  const options = {};

  // Marp front-matter at the top.
  if (lines[0]?.trim() === '---') {
    let j = 1;
    while (j < lines.length && lines[j].trim() !== '---') j++;
    if (j < lines.length) {
      for (let k = 1; k < j; k++) {
        const m = lines[k].match(/^(\w+):\s*(.*)$/);
        if (m) options[m[1]] = m[2].trim();
      }
      i = j + 1;
    }
  }

  const slides = [];
  let current = [];
  for (; i < lines.length; i++) {
    if (/^---+\s*$/.test(lines[i])) {
      if (current.some((l) => l.trim() !== '')) slides.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(lines[i]);
  }
  if (current.some((l) => l.trim() !== '')) slides.push(current.join('\n'));
  return { options, slides };
}

export function slidesCount(body) {
  return parseSlides(body).slides.length;
}
