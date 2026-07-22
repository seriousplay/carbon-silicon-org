export function isPhoneDerivedLabel(value: string | undefined) {
  const text = value?.trim();
  if (!text) return false;
  return /\d{3}\*{4}\d{4}/.test(text) || /活动空间|待填写企业名称|待补充组织名称/.test(text);
}

export function cleanOrganizationName(value: string | undefined) {
  const text = value?.trim() || "";
  return isPhoneDerivedLabel(text) ? "" : text;
}
