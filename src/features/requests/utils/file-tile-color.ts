export function getFileTileColor(name: string): string {
  if (/\.(?:xls|xlsx|xlsm|csv|ods)$/i.test(name))
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (/\.(?:doc|docx|odt|rtf)$/i.test(name))
    return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (/\.pdf$/i.test(name))
    return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (/\.(?:ppt|pptx|odp)$/i.test(name))
    return "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  if (/\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i.test(name))
    return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (/\.(?:mp3|wav|ogg|flac|aac|m4a)$/i.test(name))
    return "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  if (/\.(?:mp4|mov|avi|mkv|webm|m4v)$/i.test(name))
    return "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}
