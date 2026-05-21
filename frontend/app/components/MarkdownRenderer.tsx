'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

interface TextPart {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: boolean;
  url?: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split content by lines to process block-level elements
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  
  let currentListItems: React.ReactNode[] = [];
  let inList = false;
  let listType: 'bullet' | 'number' | null = null;
  let keyCounter = 0;

  const flushList = () => {
    if (currentListItems.length > 0) {
      const currentListKey = `list-${keyCounter++}`;
      if (listType === 'bullet') {
        renderedElements.push(
          <ul key={currentListKey} className="list-disc pl-5 mb-4 space-y-1.5 text-slate-700">
            {currentListItems}
          </ul>
        );
      } else if (listType === 'number') {
        renderedElements.push(
          <ol key={currentListKey} className="list-decimal pl-5 mb-4 space-y-1.5 text-slate-700">
            {currentListItems}
          </ol>
        );
      }
      currentListItems = [];
      inList = false;
      listType = null;
    }
  };

  const applyRegexSplit = (
    parts: TextPart[],
    regex: RegExp,
    matchTest: (substring: string) => boolean,
    createPart: (substring: string) => Partial<TextPart>
  ): TextPart[] => {
    return parts.flatMap(part => {
      if (part.bold || part.italic || part.code || part.link) return [part];
      return part.text.split(regex).map(sp => {
        if (matchTest(sp)) {
          const customFields = createPart(sp);
          return { text: customFields.text ?? sp, ...customFields } as TextPart;
        }
        return { text: sp };
      });
    });
  };

  const parseInlineStyles = (text: string): React.ReactNode[] => {
    if (!text) return [];

    let parts: TextPart[] = [{ text }];

    // 1. Inline code (`code`)
    parts = applyRegexSplit(
      parts,
      /(`[^`]+`)/g,
      sp => sp.startsWith('`') && sp.endsWith('`'),
      sp => ({ text: sp.slice(1, -1), code: true })
    );

    // 2. Links ([text](url))
    parts = applyRegexSplit(
      parts,
      /(\[[^\]]+\]\([^)]+\))/g,
      sp => /^\[([^\]]+)\]\(([^)]+)\)$/.test(sp),
      sp => {
        const match = sp.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
        return { text: match[1], link: true, url: match[2] };
      }
    );

    // 3. Bold (**bold**)
    parts = applyRegexSplit(
      parts,
      /(\*\*[^*]+\*\*)/g,
      sp => sp.startsWith('**') && sp.endsWith('**'),
      sp => ({ text: sp.slice(2, -2), bold: true })
    );

    // 4. Italic (*italic*)
    parts = applyRegexSplit(
      parts,
      /(\*[^*]+\*)/g,
      sp => sp.startsWith('*') && sp.endsWith('*'),
      sp => ({ text: sp.slice(1, -1), italic: true })
    );

    return parts.map((part, i) => {
      const partKey = `inline-${i}-${part.text.substring(0, 5)}`;
      if (part.bold) {
        return <strong key={partKey} className="font-bold text-slate-900">{part.text}</strong>;
      }
      if (part.italic) {
        return <em key={partKey} className="italic text-slate-800">{part.text}</em>;
      }
      if (part.code) {
        return <code key={partKey} className="bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded font-mono text-[13px] border border-slate-200">{part.text}</code>;
      }
      if (part.link) {
        const safeUrl = (url?: string) => {
          if (!url) return '#';
          const trimmed = url.trim().toLowerCase();
          if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
            return '#';
          }
          return url;
        };
        return (
          <a 
            key={partKey} 
            href={safeUrl(part.url)} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary-600 hover:text-primary-700 underline font-semibold transition-colors"
          >
            {part.text}
          </a>
        );
      }
      return part.text;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 1. Headers
    if (trimmedLine.startsWith('### ')) {
      flushList();
      renderedElements.push(
        <h4 key={`h3-${keyCounter++}`} className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0 font-be-vietnam">
          {parseInlineStyles(trimmedLine.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmedLine.startsWith('## ')) {
      flushList();
      renderedElements.push(
        <h3 key={`h2-${keyCounter++}`} className="text-lg font-bold text-slate-905 mt-4 mb-2 first:mt-0 font-be-vietnam">
          {parseInlineStyles(trimmedLine.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmedLine.startsWith('# ')) {
      flushList();
      renderedElements.push(
        <h2 key={`h1-${keyCounter++}`} className="text-xl font-bold text-slate-900 mt-4 mb-2 first:mt-0 font-be-vietnam">
          {parseInlineStyles(trimmedLine.slice(2))}
        </h2>
      );
      continue;
    }

    // 2. Unordered lists
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (unorderedMatch) {
      if (!inList || listType !== 'bullet') {
        flushList();
        inList = true;
        listType = 'bullet';
      }
      currentListItems.push(
        <li key={`li-${keyCounter++}`} className="text-sm md:text-[15px] leading-relaxed font-medium">
          {parseInlineStyles(unorderedMatch[3])}
        </li>
      );
      continue;
    }

    // 3. Ordered lists
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== 'number') {
        flushList();
        inList = true;
        listType = 'number';
      }
      currentListItems.push(
        <li key={`li-${keyCounter++}`} className="text-sm md:text-[15px] leading-relaxed font-medium">
          {parseInlineStyles(orderedMatch[3])}
        </li>
      );
      continue;
    }

    // 4. Blockquote
    if (trimmedLine.startsWith('> ')) {
      flushList();
      renderedElements.push(
        <blockquote key={`quote-${keyCounter++}`} className="border-l-4 border-primary-300 bg-primary-50/30 pl-4 py-1.5 pr-2 italic text-slate-600 my-3 rounded-r-lg">
          {parseInlineStyles(trimmedLine.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 5. Table parsing
    const tableRowMatch = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');
    if (tableRowMatch) {
      flushList();
      
      const tableRows: string[] = [];
      let nextIndex = i;
      while (nextIndex < lines.length && lines[nextIndex].trim().startsWith('|') && lines[nextIndex].trim().endsWith('|')) {
        tableRows.push(lines[nextIndex].trim());
        nextIndex++;
      }
      
      i = nextIndex - 1;
      
      if (tableRows.length >= 2) {
        const headers = tableRows[0].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const hasSeparator = tableRows[1].includes('---') || tableRows[1].includes(':-');
        
        let startBodyIndex = 1;
        if (hasSeparator) {
          startBodyIndex = 2;
        }
        
        const bodyRows: React.ReactNode[] = [];
        for (let r = startBodyIndex; r < tableRows.length; r++) {
          const cells = tableRows[r].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          bodyRows.push(
            <tr key={`tr-${r}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
              {cells.map((cell, cIdx) => (
                <td key={`td-${cIdx}`} className="px-4 py-2.5 text-sm text-slate-600 font-medium">
                  {parseInlineStyles(cell)}
                </td>
              ))}
            </tr>
          );
        }
        
        renderedElements.push(
          <div key={`table-wrapper-${keyCounter++}`} className="overflow-x-auto my-4 border border-slate-200 rounded-xl shadow-soft bg-white">
            <table className="min-w-full divide-y divide-slate-250">
              <thead className="bg-slate-50/75">
                <tr>
                  {headers.map((header, hIdx) => (
                    <th key={`th-${hIdx}`} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {parseInlineStyles(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bodyRows}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 6. Empty line (adds spacing)
    if (trimmedLine === '') {
      flushList();
      renderedElements.push(<div key={`space-${keyCounter++}`} className="h-2" />);
      continue;
    }

    // 7. Normal paragraph
    flushList();
    renderedElements.push(
      <p key={`p-${keyCounter++}`} className="text-sm md:text-[15px] text-slate-700 leading-relaxed mb-3 last:mb-0 font-medium">
        {parseInlineStyles(line)}
      </p>
    );
  }

  // Flush any remaining list items at the end
  flushList();

  return <div className="markdown-body space-y-1">{renderedElements}</div>;
}
