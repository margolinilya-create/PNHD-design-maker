// Порядок посадок на витрине (решение владельца, 2026-07): от меньшей
// к большей — Classic → Regular → Free/FreeFit → Oversize; Crop-вариант
// идёт после своей базовой посадки. Посадка распознаётся по имени SKU;
// неизвестные — в конец группы по алфавиту.

const FIT_RANKS: [RegExp, number][] = [
  [/classic/i, 0],
  [/regular/i, 1],
  [/free/i, 2], // проверяется раньше oversize: «FreeFit (oversized)» — это фри
  [/oversize/i, 3],
];

export function fitRank(name: string): number {
  let rank = 10;
  for (const [re, r] of FIT_RANKS) {
    if (re.test(name)) {
      rank = r;
      break;
    }
  }
  return /crop/i.test(name) ? rank + 0.5 : rank;
}

/** Отсортировать SKU по посадке (стабильно; tiebreak — имя по алфавиту). */
export function sortSkusByFit<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      fitRank(a.name) - fitRank(b.name) ||
      a.name.localeCompare(b.name, "ru"),
  );
}
