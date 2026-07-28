export type MoveDirection = "up" | "down";

export interface SortOrderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Works out the new `sortOrder` for every row after moving one of them one place.
 *
 * Rewrites the whole list rather than swapping two values, which keeps `sortOrder` contiguous
 * and zero-based no matter what state it was in beforehand — a deleted row or a half-applied
 * earlier move can leave gaps, and a swap-only approach would preserve them forever. These
 * lists are single digits long, so writing all of them costs nothing.
 *
 * Returns `null` when the move is impossible (unknown id, or already at the end).
 */
export function planReorder(
  orderedIds: string[],
  id: string,
  direction: MoveDirection,
): SortOrderUpdate[] | null {
  const currentIndex = orderedIds.indexOf(id);

  if (currentIndex === -1) {
    return null;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedIds.length) {
    return null;
  }

  const reordered = [...orderedIds];
  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];

  return reordered.map((entryId, position) => ({ id: entryId, sortOrder: position }));
}
