// Копирует воркер pdfjs в /public (статикой; webpack не парсит мин. .mjs).
// Запускается postinstall — копия всегда соответствует версии зависимости.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(
  root,
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
);
const dst = join(root, "public/pdf.worker.min.mjs");
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log("pdf.worker.min.mjs → public/");
