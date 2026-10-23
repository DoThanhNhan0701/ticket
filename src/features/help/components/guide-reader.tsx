import { useRef, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { GuideDocument } from "../api/user-guide-api";
import "./guide-document.css";

export function GuideReader({ guide }: Readonly<{ guide: GuideDocument }>) {
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
  const followDocumentLink = (event: MouseEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a") : null;
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith("#")) return;
    const index = guide.chapters.findIndex((item) =>
      item.anchors.includes(href.slice(1)),
    );
    if (index >= 0) {
      event.preventDefault();
      selectChapter(String(index + 1));
    }
  };
  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:rounded-2xl sm:border sm:border-border/80 sm:bg-card sm:shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1">
      <nav
        aria-label="Mục lục hướng dẫn"
        className="min-h-0 min-w-0 border-b border-border/70 pb-3 sm:bg-muted/20 sm:p-4 lg:overflow-y-auto lg:border-r lg:border-b-0"
      >
        <div className="lg:hidden">
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
        <div className="hidden lg:block">
          <div className="mb-4 flex items-center justify-between px-2 py-2">
            <p className="text-sm font-semibold">Mục lục</p>
            <span className="text-xs text-muted-foreground">
              {guide.chapters.length} chương
            </span>
          </div>
          <div className="space-y-1">
            {guide.chapters.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={item.title}
                title={item.title}
                aria-current={selected === index ? "page" : undefined}
                className={`flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected === index ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => selectChapter(String(index + 1))}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium tabular-nums ${selected === index ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border/60"}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {item.title.replace(/^\d+\.\s*/, "")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div
        ref={scroll}
        className="min-h-0 min-w-0 overflow-y-auto overscroll-contain"
      >
        <article
          key={selected}
          aria-labelledby="user-guide-title"
          className="px-3 py-3 sm:px-5 sm:py-4"
        >
          <div className="mb-4 border-b border-border/60 pb-3">
            <p className="mb-1.5 text-xs font-medium tracking-widest text-primary uppercase">
              Chương {String(selected + 1).padStart(2, "0")}
              <span className="mx-2 text-border" aria-hidden="true">
                /
              </span>
              <span className="tracking-normal text-muted-foreground">
                {guide.chapters.length} chương
              </span>
            </p>
            <h2
              id="user-guide-title"
              className="text-xl leading-8 font-semibold tracking-tight sm:text-2xl sm:leading-9"
            >
              {chapter.title}
            </h2>
          </div>
          {selected === 0 && guide.introductionHtml && (
            <details className="mb-6 rounded-xl border border-border/70 p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Thông tin tài liệu
              </summary>
              <div
                className="guide-document mt-4"
                onClickCapture={followDocumentLink}
                dangerouslySetInnerHTML={{ __html: guide.introductionHtml }}
              />
            </details>
          )}
          <div
            className="guide-document"
            onClickCapture={followDocumentLink}
            dangerouslySetInnerHTML={{ __html: chapter.html }}
          />
          <nav
            aria-label="Điều hướng chương"
            className="mt-10 grid grid-cols-2 gap-3 border-t border-border/60 pt-5"
          >
            <Button
              variant="outline"
              disabled={selected === 0}
              onClick={() => selectChapter(String(selected))}
              className="h-auto min-h-11 justify-start px-3 text-xs whitespace-normal sm:text-sm"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Chương trước
            </Button>
            <Button
              variant="outline"
              disabled={selected === guide.chapters.length - 1}
              onClick={() => selectChapter(String(selected + 2))}
              className="h-auto min-h-11 justify-end px-3 text-xs whitespace-normal sm:text-sm"
            >
              Chương tiếp theo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </nav>
        </article>
      </div>
    </div>
  );
}
