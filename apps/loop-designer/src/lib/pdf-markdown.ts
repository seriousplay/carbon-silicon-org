type TableBlock = {
  headers: string[];
  rows: string[][];
};

export function renderMarkdownForPdfHtml(markdown: string) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      closeList();
      index += 1;
      continue;
    }

    const table = readTable(lines, index);
    if (table) {
      closeList();
      html.push(renderTable(table.block));
      index = table.nextIndex;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      index += 1;
      continue;
    }

    const listItem = /^-\s+(.+)$/.exec(line);
    if (listItem) {
      if (!listOpen) {
        html.push('<ul class="report-list">');
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      index += 1;
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
    index += 1;
  }

  closeList();
  return html.join("");
}

function readTable(lines: string[], startIndex: number): { block: TableBlock; nextIndex: number } | null {
  const header = lines[startIndex]?.trim() ?? "";
  const separator = lines[startIndex + 1]?.trim() ?? "";
  if (!isTableRow(header) || !isTableSeparator(separator)) return null;

  const headers = parseTableRow(header);
  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length && isTableRow(lines[index].trim())) {
    rows.push(normalizeRow(parseTableRow(lines[index].trim()), headers.length));
    index += 1;
  }
  return { block: { headers, rows }, nextIndex: index };
}

function renderTable(table: TableBlock) {
  const columnCount = table.headers.length;
  return [
    `<div class="table-wrap cols-${Math.min(columnCount, 8)}">`,
    "<table>",
    "<thead><tr>",
    ...table.headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`),
    "</tr></thead>",
    "<tbody>",
    ...table.rows.map((row) => `<tr>${normalizeRow(row, columnCount).map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`),
    "</tbody></table></div>",
  ].join("");
}

function normalizeRow(row: string[], size: number) {
  return Array.from({ length: size }, (_, index) => row[index] ?? "");
}

function isTableRow(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isTableSeparator(line: string) {
  if (!isTableRow(line)) return false;
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableRow(line: string) {
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  for (const character of line.slice(1, -1)) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}
