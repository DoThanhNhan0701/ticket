export function mentionAtCaret(value: string, caret: number) {
  const match = /(?:^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(value.slice(0, caret));
  if (!match) return null;
  return {
    search: match[1],
    start: caret - match[1].length - 1,
    end:
      caret + (/^[\p{L}\p{N}_.-]*/u.exec(value.slice(caret))?.[0].length ?? 0),
  };
}
