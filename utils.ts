
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

export const renderLatex = (text: string) => {
  if (!text) return null;
  
  // Xử lý các ký tự thoát đặc biệt nếu cần thiết trước khi split
  // Đảm bảo dấu gạch chéo ngược được bảo toàn
  const safeText = text.replace(/\\/g, '\\\\').replace(/\\\\\\\\/g, '\\\\');

  // Split dựa trên $...$ (inline math)
  // Lưu ý: Chúng ta không dùng safeText ở đây vì split regex sẽ tự xử lý, 
  // nhưng cần cẩn thận với cách JS xử lý backslash trong string
  const parts = text.split(/(\$[^\$]+\$)/g);

  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: false,
          strict: false
        });
        return React.createElement('span', { 
          key: i, 
          className: 'inline-block align-middle',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('span', { key: i }, part); 
      }
    }
    return React.createElement('span', { key: i }, part);
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
