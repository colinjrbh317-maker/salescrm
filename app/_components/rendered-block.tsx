"use client";

import React from "react";
import type { Block } from "@/lib/markdown-renderer";
import { renderInlineMarkdown } from "@/lib/markdown-renderer";

export function RenderedBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const sizeClass =
        block.level === 1
          ? "text-2xl font-bold text-white mt-6 mb-3"
          : block.level === 2
          ? "text-xl font-semibold text-white mt-5 mb-2"
          : "text-lg font-medium text-white mt-4 mb-2";
      const children = renderInlineMarkdown(block.text);
      if (block.level === 1) return <h1 className={sizeClass}>{children}</h1>;
      if (block.level === 2) return <h2 className={sizeClass}>{children}</h2>;
      if (block.level === 3) return <h3 className={sizeClass}>{children}</h3>;
      if (block.level === 4) return <h4 className={sizeClass}>{children}</h4>;
      if (block.level === 5) return <h5 className={sizeClass}>{children}</h5>;
      return <h6 className={sizeClass}>{children}</h6>;
    }

    case "paragraph":
      return (
        <p className="text-slate-300 leading-relaxed">
          {renderInlineMarkdown(block.text)}
        </p>
      );

    case "blockquote":
      return (
        <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-2">
          {block.lines.map((line, i) => (
            <p key={i} className="text-slate-400 italic leading-relaxed">
              {renderInlineMarkdown(line)}
            </p>
          ))}
        </blockquote>
      );

    case "unordered-list":
      return (
        <ul className="list-disc list-inside space-y-1 text-slate-300 ml-2">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );

    case "ordered-list":
      return (
        <ol className="list-decimal list-inside space-y-1 text-slate-300 ml-2">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );

    case "code-block":
      return (
        <pre className="rounded-lg bg-slate-950 border border-slate-700 p-4 overflow-x-auto my-2">
          <code className="text-sm text-emerald-400 font-mono">
            {block.lines.join("\n")}
          </code>
        </pre>
      );

    case "table":
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead>
              <tr>
                {block.headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-800"
                  >
                    {renderInlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "hr":
      return <hr className="border-slate-700 my-4" />;

    default:
      return null;
  }
}
