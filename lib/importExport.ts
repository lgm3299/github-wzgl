import { supabase } from './supabase';

// ============================================
// Excel/CSV 导入导出工具
// ============================================

/**
 * 下载 CSV 模板
 */
export function downloadTemplate(columns: { key: string; label: string }[], filename: string) {
  const header = columns.map(c => c.label).join(',');
  const sampleRow = columns.map(c => '').join(',');
  const csvContent = `\uFEFF${header}\n${sampleRow}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * 下载 CSV 数据
 */
export function downloadCSV(data: any[], columns: { key: string; label: string }[], filename: string) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      let value = row[col.key];
      if (value === null || value === undefined) return '';
      // 处理包含逗号或换行符的值
      const str = String(value);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  const csvContent = `\uFEFF${header}\n${rows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * 解析 CSV 文件
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentValue);
        currentValue = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentValue);
        if (currentRow.some(cell => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }
  
  currentRow.push(currentValue);
  if (currentRow.some(cell => cell.trim() !== '')) {
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * CSV 转换为对象数组
 */
export function csvToObjects(csvText: string, columns: { key: string; label: string }[]): any[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  return dataRows.map(row => {
    const obj: any = {};
    columns.forEach((col, index) => {
      const value = row[index] || '';
      // 尝试转换为数字
      const num = Number(value);
      obj[col.key] = value === '' ? null : (!isNaN(num) && value.trim() !== '' ? num : value);
    });
    return obj;
  });
}

/**
 * 文件上传组件
 */
export interface UploadProps {
  accept?: string;
  maxSize?: number; // MB
  onChange?: (file: File | null) => void;
}
