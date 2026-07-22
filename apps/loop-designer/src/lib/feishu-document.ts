export type FeishuDocumentItem =
  | { type: "text"; content: string }
  | { type: "table"; rows: string[][] };

export function parseMarkdownForFeishu(markdown: string): FeishuDocumentItem[] {
  const lines = markdown.split("\n");
  const items: FeishuDocumentItem[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() ?? "";
    if (isTableRow(line) && isTableSeparator(nextLine)) {
      const rows = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && isTableRow(lines[index].trim())) {
        rows.push(parseTableRow(lines[index].trim()));
        index += 1;
      }
      items.push({ type: "table", rows });
      continue;
    }

    items.push({ type: "text", content: line });
    index += 1;
  }

  return items;
}

export function buildFeishuTableDescendants(rows: string[][], prefix: string) {
  const columnSize = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnSize }, (_, index) => row[index] ?? ""),
  );
  const tableId = `${prefix}_table`;
  const cellIds = normalizedRows.flatMap((row, rowIndex) =>
    row.map((_, columnIndex) => `${prefix}_cell_${rowIndex}_${columnIndex}`),
  );
  const descendants: Array<Record<string, unknown>> = [{
    block_id: tableId,
    block_type: 31,
    table: { property: { row_size: normalizedRows.length, column_size: columnSize } },
    children: cellIds,
  }];

  normalizedRows.forEach((row, rowIndex) => {
    row.forEach((content, columnIndex) => {
      const cellId = `${prefix}_cell_${rowIndex}_${columnIndex}`;
      const textId = `${cellId}_text`;
      descendants.push({
        block_id: cellId,
        block_type: 32,
        table_cell: {},
        children: [textId],
      });
      descendants.push({
        block_id: textId,
        block_type: 2,
        text: {
          elements: [{
            text_run: {
              content,
              text_element_style: rowIndex === 0 ? { bold: true } : {},
            },
          }],
          style: {},
        },
        children: [],
      });
    });
  });

  return { children_id: [tableId], descendants };
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
