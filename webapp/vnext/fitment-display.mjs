// Display only: preserve every supplied decimal digit and never parse/round API values.
export function fitmentDisplayValue(value, locale = "ru") {
  const text = String(value ?? "");
  return locale === "ru" ? text.replace(/(?<=\d)\.(?=\d)/g, ",") : text.replace(/(?<=\d),(?=\d)/g, ".");
}
