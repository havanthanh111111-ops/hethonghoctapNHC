
import katex from 'katex';
import React from 'react';

export const getSafeEnv = (key: string): string | undefined => {
  try {
    const fromProcess = (process.env as any)[key] || (process.env as any)[`VITE_${key}`];
    if (fromProcess) return fromProcess;
    const fromMeta = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (fromMeta) return fromMeta;
  } catch (e) {}
  return undefined;
};

export const normalizeImageUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  const driveMatch = trimmed.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return trimmed;
};

// Render đoạn text có chứa markdown hình ảnh ![alt](url), link [text](url), thẻ <img> hoặc url ảnh trực tiếp
const renderTextWithMedia = (plainText: string, keyPrefix: string | number) => {
  if (!plainText) return null;

  // Regex nhận diện:
  // 1. Markdown image: !\[(.*?)\]\((.*?)\)
  // 2. HTML image: <img\s+[^>]*src=["'](.*?)["'][^>]*\/?>
  // 3. Markdown link: \[((?!img).*?)\]\((.*?)\)
  // 4. URL ảnh đứng trực tiếp: https://... (png|jpg|jpeg|gif|webp|svg)
  const mediaRegex = /(!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)|<img\s+[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*\/?>|\[(.*?)\]\((https?:\/\/[^\s\)]+)\)|(?:\b)(https?:\/\/[^\s<]+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s<]*)?))/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaRegex.exec(plainText)) !== null) {
    if (match.index > lastIndex) {
      elements.push(plainText.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const matchKey = `${keyPrefix}_m_${match.index}`;

    if (fullMatch.startsWith('![')) {
      // Markdown image ![alt](url)
      const alt = match[2] || 'Hình ảnh';
      const rawUrl = match[3];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt,
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    } else if (fullMatch.toLowerCase().startsWith('<img')) {
      // HTML img
      const rawUrl = match[4];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt: 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    } else if (fullMatch.startsWith('[')) {
      // Markdown link [text](url)
      const linkText = match[5] || match[6];
      const linkUrl = match[6];
      elements.push(
        React.createElement('a', {
          key: matchKey,
          href: linkUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-indigo-600 hover:text-indigo-800 underline font-semibold'
        }, linkText)
      );
    } else {
      // Direct image URL
      const rawUrl = match[7];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt: 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    }

    lastIndex = mediaRegex.lastIndex;
  }

  if (lastIndex < plainText.length) {
    elements.push(plainText.substring(lastIndex));
  }

  return elements.length > 0 ? elements : plainText;
};

export const renderLatex = (text: string) => {
  if (!text) return null;
  
  // Tách text thành các phần:
  // 1. $$...$$ (Công thức khối / Display math trên dòng riêng)
  // 2. $...$ (Công thức nằm cùng dòng / Inline math)
  // 3. \r?\n (Dấu xuống dòng khi gõ Enter)
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\r?\n)/g);

  return parts.map((part, i) => {
    if (!part) return null;

    // Xuống dòng khi người dùng bấm Enter
    if (part === '\n' || part === '\r\n') {
      return React.createElement('br', { key: i });
    }

    // Công thức dạng khối $$...$$
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const math = part.slice(2, -2).trim();
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: true,
          strict: false,
          output: 'html'
        });
        return React.createElement('div', { 
          key: i, 
          className: 'my-2 overflow-x-auto text-center',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('div', { key: i, className: 'my-2 text-center text-red-500 font-mono text-xs' }, part); 
      }
    }

    // Công thức dạng cùng dòng $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      const math = part.slice(1, -1).trim();
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: false,
          strict: false,
          output: 'html'
        });
        return React.createElement('span', { 
          key: i, 
          className: 'inline mx-0.5',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('span', { key: i }, part); 
      }
    }

    return React.createElement('span', { key: i }, renderTextWithMedia(part, i));
  });
};

export const SLOGANS = [
  "\"Logic sẽ đưa bạn từ A đến B. Trí tưởng tượng sẽ đưa bạn tới mọi nơi.\" — Albert Einstein",
  "\"Nếu tôi nhìn thấy xa hơn những người khác, đó là vì tôi đứng trên vai những người khổng lồ.\" — Isaac Newton",
  "\"Tôi không thất bại. Tôi chỉ là đã tìm ra 10.000 cách không hoạt động.\" — Thomas Edison",
  "\"Cuộc sống giống như lái một chiếc xe đạp. Để giữ thăng bằng, bạn phải liên tục tiến về phía trước.\" — Albert Einstein",
  "\"Khoa học không chỉ là một môn học, nó là một cách suy nghĩ.\" — Carl Sagan",
  "\"Mọi sự phức tạp đều bắt nguồn từ những quy luật đơn giản.\" — Richard Feynman",
  "\"Trên đời này không có gì đáng sợ, chỉ có những thứ chưa được hiểu rõ.\" — Marie Curie",
  "\"Những gì chúng ta biết chỉ là một giọt nước, những gì chúng ta chưa biết là cả một đại dương.\" — Isaac Newton"
];
