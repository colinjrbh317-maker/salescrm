// Shared markdown parsing utilities
// Extracted from scripts/[id]/script-viewer.tsx for reuse across session cards and script displays

import type { ReactElement } from "react";
import React from "react";

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code-block"; language: string; lines: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

let keyIdx = 0;

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const patterns: {
      regex: RegExp;
      render: (match: RegExpMatchArray) => ReactElement;
    }[] = [
      {
        // {{FIELD}} merge fields
        regex: /\{\{([^}]+)\}\}/,
        render: (m) =>
          React.createElement(
            "span",
            {
              key: `mf-${keyIdx++}`,
              className:
                "rounded bg-amber-600/20 px-1.5 py-0.5 text-amber-400 font-mono text-sm border border-amber-500/30",
            },
            `{{${m[1]}}}`
          ),
      },
      {
        // `inline code`
        regex: /`([^`]+)`/,
        render: (m) =>
          React.createElement(
            "code",
            {
              key: `ic-${keyIdx++}`,
              className:
                "rounded bg-slate-700 px-1.5 py-0.5 text-sm text-emerald-400 font-mono",
            },
            m[1]
          ),
      },
      {
        // **bold**
        regex: /\*\*([^*]+)\*\*/,
        render: (m) =>
          React.createElement(
            "strong",
            {
              key: `b-${keyIdx++}`,
              className: "font-semibold text-white",
            },
            m[1]
          ),
      },
      {
        // *italic*
        regex: /\*([^*]+)\*/,
        render: (m) =>
          React.createElement(
            "em",
            {
              key: `i-${keyIdx++}`,
              className: "italic text-slate-300",
            },
            m[1]
          ),
      },
    ];

    let earliestIndex = remaining.length;
    let earliestPattern: (typeof patterns)[0] | null = null;
    let earliestMatch: RegExpMatchArray | null = null;

    for (const pat of patterns) {
      const match = remaining.match(pat.regex);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
        earliestPattern = pat;
        earliestMatch = match;
      }
    }

    if (
      !earliestPattern ||
      !earliestMatch ||
      earliestMatch.index === undefined
    ) {
      elements.push(remaining);
      break;
    }

    if (earliestIndex > 0) {
      elements.push(remaining.slice(0, earliestIndex));
    }

    elements.push(earliestPattern.render(earliestMatch));
    remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
  }

  return elements;
}

export function parseMarkdownBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Code block (fenced)
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code-block", language, lines: codeLines });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Table
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());

      const headers = tableLines.length > 0 ? parseRow(tableLines[0]) : [];
      const isSeparator = (row: string) =>
        /^\|[\s-:|]+\|$/.test(row.trim());

      const dataLines = tableLines
        .slice(1)
        .filter((row) => !isSeparator(row));
      const rows = dataLines.map(parseRow);
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !lines[i].startsWith("> ") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join("\n") });
    }
  }

  return blocks;
}
