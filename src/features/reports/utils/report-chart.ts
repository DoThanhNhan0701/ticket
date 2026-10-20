const colors = [
  "#7c72b8",
  "#2f9fbe",
  "#529f62",
  "#dc9f32",
  "#d96b78",
  "#6a8cd9",
  "#a178a1",
  "#45a692",
  "#c67f43",
  "#8ca146",
  "#ba6fbb",
  "#4584af",
  "#a78e57",
];
export const reportNumberFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
});
export function reportChartColor(index: number) {
  return colors[index] ?? `hsl(${Math.round((index * 137.508) % 360)} 48% 56%)`;
}
export function reportRateDescription(
  label: string,
  [rate, count, total]: readonly [number, number, number],
) {
  return `${label}: ${reportNumberFormat.format(count)}/${reportNumberFormat.format(total)} (${reportNumberFormat.format(rate)}%)`;
}
