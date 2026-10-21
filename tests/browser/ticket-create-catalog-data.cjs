const { format, addDays, startOfToday } = require("date-fns");
const clean = (text) => text.split("(*)").join("").trim();
function plannedDates(fields) {
  const dates = fields.filter(
    (field) => field.type.includes("date") && !field.option?.length,
  );
  const offsets = new Map(dates.map((field) => [clean(field.title), 0]));
  const edges = [];
  for (const field of dates) {
    const rule = field.validate;
    if (!rule || typeof rule !== "object") continue;
    const target = clean(String(rule.target || ""));
    const name = clean(field.title);
    if (!offsets.has(target)) continue;
    if (rule.operator === ">" || rule.operator === ">=")
      edges.push([target, name, rule.operator === ">" ? 1 : 0]);
    if (rule.operator === "<" || rule.operator === "<=")
      edges.push([name, target, rule.operator === "<" ? 1 : 0]);
  }
  for (let iteration = 0; iteration <= dates.length; iteration++) {
    let changed = false;
    for (const [from, to, distance] of edges) {
      const next = offsets.get(from) + distance;
      if (offsets.get(to) < next) {
        offsets.set(to, next);
        changed = true;
      }
    }
    if (!changed) return offsets;
    if (iteration === dates.length)
      throw Error("Date rules have no valid ordering");
  }
  return offsets;
}

function fieldValue(field, row, offsets, day = startOfToday()) {
  const label = clean(field.title);
  const choices = (field.option || [])
    .map((option) => (Array.isArray(option) ? option[1] : option).trim())
    .filter(Boolean);
  if (choices.length) return choices[row % choices.length];
  if (field.type.includes("date"))
    return format(
      addDays(day, 7 + (offsets.get(label) || 0) + row),
      "dd/MM/yyyy",
    );
  return field.type === "number"
    ? String(row)
    : "TEST QC " + label + " - dòng " + (row + 1);
}
module.exports = { clean, plannedDates, fieldValue };
