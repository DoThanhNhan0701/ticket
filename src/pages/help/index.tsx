import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { buttonVariants } from "@/components/ui/button-variants";
import guide from "@/features/help/user-guide.json";

interface GuideBlock {
  type: string;
  text?: string;
  rows?: string[][];
}

function GuideContent({ block }: Readonly<{ block: GuideBlock }>) {
  if (block.type === "table" && block.rows?.length) {
    const [header, ...rows] = block.rows;
    return (
      <div className="max-w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {header.map((cell, index) => (
                <th
                  key={index}
                  scope="col"
                  className="min-w-32 px-4 py-3 font-semibold"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border align-top">
                {row.map((cell, column) => (
                  <td
                    key={column}
                    className="px-4 py-3 leading-6 whitespace-pre-line wrap-anywhere"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "heading")
    return (
      <h3 className="pt-3 text-base font-semibold text-foreground">
        {block.text}
      </h3>
    );
  if (block.type === "bullet")
    return (
      <p className="flex gap-2 text-sm leading-7">
        <span aria-hidden="true">•</span>
        <span>{block.text}</span>
      </p>
    );
  return (
    <p className="text-sm leading-7 whitespace-pre-line wrap-anywhere">
      {block.text}
    </p>
  );
}

export function UserGuidePage() {
  const [params, setParams] = useSearchParams();
  const scroll = useRef<HTMLDivElement>(null);
  const requested = Number(params.get("chapter") ?? 1);
  const selected =
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= guide.chapters.length
      ? requested - 1
      : 0;
  const chapter = guide.chapters[selected];
  const selectChapter = (value: string) => {
    setParams({ chapter: value });
    scroll.current?.scrollTo?.({ top: 0 });
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <PageHeader
        title="Hướng dẫn sử dụng"
        description={`Phiên bản ${guide.version} · Cập nhật ${guide.updatedAt}`}
        icon={BookOpen}
        actions={
          <a
            href={`/docs/${guide.fileName}`}
            download={guide.fileName}
            title="Tải tài liệu Word"
            aria-label="Tải tài liệu Word"
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Tải Word</span>
          </a>
        }
      />
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 xl:grid-cols-[17rem_minmax(0,1fr)] xl:grid-rows-1">
        <nav
          aria-label="Mục lục hướng dẫn"
          className="min-h-0 min-w-0 rounded-xl border border-border bg-card p-3 xl:overflow-y-auto"
        >
          <div className="xl:hidden">
            <SearchableSelect
              id="user-guide-chapter"
              label="Chọn chương hướng dẫn"
              value={String(selected + 1)}
              options={guide.chapters.map((item, index) => ({
                value: String(index + 1),
                label: item.title,
              }))}
              onValueChange={selectChapter}
            />
          </div>
          <div className="hidden space-y-1 xl:block">
            <p className="px-3 py-2 text-sm font-semibold">Mục lục</p>
            {guide.chapters.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-current={selected === index ? "page" : undefined}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected === index ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => selectChapter(String(index + 1))}
              >
                {item.title}
              </button>
            ))}
          </div>
        </nav>
        <div
          ref={scroll}
          className="min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card"
        >
          <article
            key={selected}
            aria-labelledby="user-guide-title"
            className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8"
          >
            <h2
              id="user-guide-title"
              className="text-xl leading-8 font-semibold tracking-tight"
            >
              {chapter.title}
            </h2>
            {chapter.blocks.map((block, index) => (
              <GuideContent key={index} block={block} />
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}
