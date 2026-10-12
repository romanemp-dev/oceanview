// Minimal dependency-free markdown renderer (R-06).
// Security model: everything is HTML-escaped first; links are restricted to
// http/https/mailto; no raw HTML ever passes through.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(rawUrl) {
  // rawUrl is already HTML-escaped; unescape &, then check the protocol.
  const url = rawUrl.replace(/&amp;/g, '&').trim();
  if (/^(https?:\/\/|mailto:)/i.test(url)) return rawUrl;
  return '#';
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => `<a href="${safeHref(url)}" rel="noopener noreferrer">${label}</a>`);
}

export function renderMarkdown(src) {
  const codeBlocks = [];
  let text = src.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000CODE${i}\u0000`;
  });

  text = escapeHtml(text);

  const lines = text.split('\n');
  const out = [];
  const listStack = [];
  let para = [];
  let taskIndex = 0;

  const closeLists = () => { while (listStack.length) out.push(`</${listStack.pop()}>`); };
  const flushPara = () => { if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; } };
  const openList = (tag) => {
    if (listStack[listStack.length - 1] !== tag) {
      closeLists();
      listStack.push(tag);
      out.push(`<${tag}>`);
    }
  };

  for (const line of lines) {
    const codeMatch = line.match(/^\u0000CODE(\d+)\u0000$/);
    if (codeMatch) {
      flushPara();
      closeLists();
      out.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      closeLists();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const task = line.match(/^\s*[-*]\s+\[( |x|X)\]\s*(.*)$/);
    if (task) {
      flushPara();
      openList('ul');
      const done = task[1] !== ' ';
      out.push(
        `<li class="task"><input type="checkbox" data-task="${taskIndex}"${done ? ' checked' : ''}> ${inline(task[2])}</li>`,
      );
      taskIndex++;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      openList('ul');
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      openList('ol');
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      closeLists();
      continue;
    }

    para.push(inline(line));
  }
  flushPara();
  closeLists();
  return out.join('\n');
}
