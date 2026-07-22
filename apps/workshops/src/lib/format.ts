export function formatChineseDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

export function groupByYear<T extends { publishedAt: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const year = item.publishedAt.slice(0, 4);
    groups[year] = [...(groups[year] ?? []), item];
    return groups;
  }, {});
}
