export function formatNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseNumberInput(value: string): number {
  return Number(value.replace(/\./g, ""));
}
