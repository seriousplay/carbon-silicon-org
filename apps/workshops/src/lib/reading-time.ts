const CODE_FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`]*`/g;
const MARKDOWN_SYNTAX = /[#>*_[\]()!-]/g;
const CJK_CHARACTER = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

export function calculateReadingMinutes(markdown: string) {
  const text = markdown
    .replace(CODE_FENCE, " ")
    .replace(INLINE_CODE, " ")
    .replace(MARKDOWN_SYNTAX, " ");

  const cjkCount = text.match(CJK_CHARACTER)?.length ?? 0;
  const latinCount = text.match(LATIN_WORD)?.length ?? 0;
  const minutes = cjkCount / 400 + latinCount / 220;

  return Math.max(1, Math.ceil(minutes));
}
