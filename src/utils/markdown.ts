import DOMPurify from "dompurify";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

const markdown = new Marked({
  breaks: true,
  gfm: true,
});

markdown.use(
  markedKatex({
    nonStandard: true,
    strict: false,
    throwOnError: false,
  }),
);

export function renderMarkdown(source = ""): string {
  return DOMPurify.sanitize(markdown.parse(source) as string);
}
