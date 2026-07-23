/**
 * Turns raw enum/slug values into display labels.
 *
 * Naive title-casing produces "Ac Servicing" and "Cctv & Fire", which reads as a
 * typo to anyone in the trade. Any token listed here keeps its correct casing.
 */
const ACRONYMS: Record<string, string> = {
  ac: 'AC',
  cctv: 'CCTV',
  hvac: 'HVAC',
  ht: 'HT',
  lt: 'LT',
  kva: 'kVA',
  it: 'IT',
  hr: 'HR',
  ups: 'UPS',
  led: 'LED',
  pvc: 'PVC',
  rcc: 'RCC',
  mep: 'MEP',
  dg: 'DG',
  sme: 'SME',
};

/** "ac_servicing" -> "AC Servicing", "interior_work" -> "Interior Work". */
export function humanizeEnum(value: string): string {
  if (!value) return '';

  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(word => {
      const lower = word.toLowerCase();
      return ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
