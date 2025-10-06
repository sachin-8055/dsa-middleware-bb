import { fileTypeFromBuffer } from "file-type";
import { agentStore } from "../store/agentStore";
import { RegexMaskRules } from "../types/Agent";
import { pathToFileURL } from "url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import path from "path";
import { reportService } from "./reportService";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

// 🔹 Full mask (same as C# IsFullMask true)
function maskFull(value: string, maskWith: string = "*"): string {
  const char = maskWith?.[0] || "*";
  return char.repeat(value.length);
}

// 🔹 Partial mask (same as PartialMask in .NET)
function partialMask(value: string, maskWith: string = "*"): string {
  if (value.length <= 4) return maskWith.repeat(value.length);
  return value.substring(0, 2) + maskWith.repeat(value.length - 4) + value.substring(value.length - 2);
}

export function mask(input: string, isFullMask: boolean = false, maskWith: string = "*"): string {
  if (!input) return input;

  return isFullMask ? maskFull(input, maskWith) : partialMask(input, maskWith);
}

export function maskData(input: string, rule?: RegexMaskRules): string {
  if (!input) return input;
  let masked = input;

  // console.log("🔒 masked :", masked);
  // 🟢 Apply single custom rule if provided
  if (rule) {
    const regex = new RegExp(rule.pattern || "", "gi");
    masked = masked.replace(regex, (match) => {
      reportService.addRuleResult({
        name: rule?.name || "Unknown",
        pattern: rule?.pattern?.toString() || "Unknown",
        matchCount: 1,
        isMask: true,
        isEncrypt: false,
      });
      return rule.isFullMask ? maskFull(match, rule.maskWith) : partialMask(match);
    });
  } else {
    // 🟢 Otherwise, apply all rules from agentStore
    const rules = agentStore.agent?.configurations?.regxRules ?? [];

    if (rules.length > 0) {
      for (const r of rules) {
        const regex = new RegExp(r.pattern || "", "gi");
        masked = masked.replace(regex, (match) => {
          // console.log("🔒 match text :", match, " with rule:", r?.name);
          reportService.addRuleResult({
            name: r?.name || "Unknown",
            pattern: r?.pattern?.toString() || "Unknown",
            matchCount: 1,
            isMask: true,
            isEncrypt: false,
          });
          const newText = r.isFullMask ? maskFull(match, r.maskWith) : partialMask(match);
          // console.log("🔒 masked text :", newText);
          return newText;
        });
      }
    }
  }

  return masked;
}
/** Extract PDF text with coordinates */
export async function extractPdfTextWithPositions(pdfBuffer: Buffer) {
  try {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.debug("PDF buffer is empty");
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;

    const textPositions: {
      text: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      content.items.forEach((item: any) => {
        if (!item.str?.trim()) return;
        textPositions.push({
          text: item.str,
          page: pageNum - 1,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
        });
      });
    }

    return textPositions;
  } catch (error) {
    console.error("❌ PDF text extraction failed:", error);
    return [];
  }
}

/** PDF masking with rules */
export async function maskPDF(buffer: Buffer): Promise<Buffer> {
  const rules: RegexMaskRules[] = agentStore.agent?.configurations?.regxRules ?? [];
  if (rules.length === 0) return buffer;

  const matchesToMask: any[] = [];
  const positions = await extractPdfTextWithPositions(buffer);

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern || "", "gi");
    for (const pos of positions) {
      const match = pos.text.match(regex);
      if (match) {
        const matchedText = match[0];
        const relativeIndex = pos.text.indexOf(matchedText);
        const totalChars = pos.text.length;
        const matchedChars = matchedText.length;
        const proportion = relativeIndex / totalChars;
        const approxStartX = pos.x + pos.width * proportion;

        matchesToMask.push({
          ...pos,
          matchedText,
          maskWith: rule.maskWith,
          isFullMask: rule.isFullMask,
          ruleName: rule.name,
          approxX: approxStartX,
          approxWidth: (pos.width * matchedChars) / totalChars,
        });
      }
    }
  }

  if (matchesToMask.length === 0) return buffer;

  const pdfDoc = await PDFDocument.load(buffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const match of matchesToMask) {
    // console.log("🔒 match PDF text :", JSON.stringify(match, null, 2));
    const page = pages[match.page];
    page.drawRectangle({
      x: match.approxX - 2,
      y: match.y,
      width: match.approxWidth * 1.2,
      height: match.height,
      color: rgb(0, 0, 0),
    });

    let txt = await mask(match.matchedText, match.isFullMask, match.maskWith);
    page.drawText(txt, {
      x: match.approxX + 1,
      y: match.y + 1,
      size: 8,
      font,
      color: rgb(1, 1, 1),
    });
  }

  const arrayBuffer = await pdfDoc.save();

  reportService.addFileCount("pdf", 1);

  return Buffer.from(arrayBuffer);
}

/** DOCX masking */
export async function maskDOCX(buffer: Buffer): Promise<Buffer> {
  const zip = new PizZip(buffer);
  const xmlFile = zip.file("word/document.xml")?.asText();

  if (!xmlFile) {
    console.warn("⚠️ document.xml not found in DOCX");
    return buffer;
  }

  // Setup parser for order preservation and attributes
  const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
  });
  const json = parser.parse(xmlFile);

  // Recursive mask
  function maskTextNodes(node: any) {
    if (Array.isArray(node)) {
      node.forEach(maskTextNodes);
    } else if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        if (key === "w:t") {
          // <w:t>Text</w:t> or <w:t>{#text:'Text'}</w:t>
          if (typeof node[key] === "string") {
            node[key] = maskData(node[key]);
          } else if (Array.isArray(node[key])) {
            node[key] = node[key].map((v) => {
              if (typeof v === "string") return maskData(v);
              if (v && typeof v["#text"] === "string") {
                v["#text"] = maskData(v["#text"]);
                return v;
              }
              return v;
            });
          }
        } else {
          maskTextNodes(node[key]);
        }
      }
    }
  }
  maskTextNodes(json);

  // Build new XML
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    preserveOrder: true,
    format: false, // no pretty print, keep original
  });
  const maskedXml = builder.build(json);

  // Replace docx internal XML
  zip.file("word/document.xml", maskedXml);

  // Generate final DOCX buffer
  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
/** XLSX masking */
export async function maskXLSX(buffer: Buffer): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // ✅ Convert Node Buffer → ArrayBuffer (with safe cast)
  const inputArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  await workbook.xlsx.load(inputArrayBuffer);

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") {
          cell.value = maskData(cell.value);
        }
      });
    });
  });

  // Convert ArrayBuffer to Node.js Buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  reportService.addFileCount("xlsx", 1);
  return Buffer.from(arrayBuffer);
}

/** Detect file type and route to correct masking handler */
export async function maskFileFromBuffer(buffer: Buffer, mime: string): Promise<Buffer> {
  const detected = await fileTypeFromBuffer(buffer);
  const type = detected?.mime || mime;
  console.log("📦 Masking MIME:", type);
  if (type.includes("pdf")) return await maskPDF(buffer);
  if (type.includes("wordprocessingml")) return await maskDOCX(buffer);
  if (type.includes("spreadsheetml") || type.includes("excel")) return await maskXLSX(buffer);

  if (type.includes("text") || type.includes("csv")) {
    const masked = maskData(buffer.toString("utf8"));
    return Buffer.from(masked, "utf8");
  }

  return buffer; // fallback: unsupported type
}
