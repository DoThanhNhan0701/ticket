export const templateCombinations = Array.from({ length: 8 }, (_, mask) => ({
  name: `R${(mask >> 2) & 1}H${(mask >> 1) & 1}S${mask & 1}`,
  required: Boolean(mask & 4),
  handling: Boolean(mask & 2),
  status: Boolean(mask & 1),
}));
