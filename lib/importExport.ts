/**
 * Excel/CSV 导入导出工具
 * 修复：CSV 注入、URL.revokeObjectURL 时序、参数校验、错误日志
 */

// ============================================
// 常量配置
// ============================================
const CSV_BOM = '\uFEFF';
const CSV_MIME_TYPE = 'text/csv;charset=utf-8;';
const MAX_CSV_ROWS = 10000;       // 最大导出行数
const MAX_FILE_SIZE_MB = 10;       // 最大导入文件大小（MB）
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * CSV 注入危险字符：单元格以这些字符开头时，Excel 会将其解释为公式执行
 * 参考：https://owasp.org/www-community/attacks/CSV_Injection
 */
const CSV_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r'];

// ============================================
// 通用工具函数
// ============================================

/**
 * 检查并转义 CSV 注入危险字符
 * 如果值以危险字符开头，在前面添加单引号（CSV 安全做法）
 */
function escapeCsvInjection(value: string): string {
  if (!value) return value;
  const str = String(value);
  if (CSV_INJECTION_CHARS.some(ch => str.startsWith(ch))) {
    return `'${str}`;
  }
  return str;
}

/**
 * 安全地下载 Blob（修复 revokeObjectURL 时序问题）
 * 等待 click 事件处理完成后再释放 URL
 */
function safeDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // 添加到 DOM 以确保某些浏览器（Firefox）能正确触发下载
  document.body.appendChild(link);
  link.click();

  // 延迟释放 URL，确保下载已触发
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * 将行数组转换为 CSV 行字符串（含转义）
 */
function rowToCsvRow(row: any[], columns: { key: string; label: string }[]): string {
  return row
    .map((value, index) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // 处理包含逗号、换行符、双引号的值
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return escapeCsvInjection(str);
    })
    .join(',');
}

// ============================================
// 打印导出函数（A4 纸 + 表头 + 签字栏）
// ============================================

/**
 * 导出为 A4 可打印 HTML 表格，浏览器「另存为 PDF」或直接打印
 * 表头「两江校区后勤物资表」、打印时间（另起一行）、签字栏
 * @page margin 0 完全去掉浏览器页眉页脚；数据每页 35 行，每页均有完整表头和签名栏
 */
export function printMaterials(data: any[]): void {
  if (!data || data.length === 0) {
    message?.warning('暂无数据可打印');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('请允许浏览器弹出窗口以打印');
    return;
  }

  const NOW = new Date();
  const PRINT_TIME = NOW.getFullYear() + '年'
    + String(NOW.getMonth() + 1).padStart(2, '0') + '月'
    + String(NOW.getDate()).padStart(2, '0') + '日 '
    + String(NOW.getHours()).padStart(2, '0') + ':'
    + String(NOW.getMinutes()).padStart(2, '0');

  const ROWS_PER_PAGE = 35;
  const PAGE_COUNT = Math.ceil(data.length / ROWS_PER_PAGE);

  const cols = [
    { label: '序号', key: '_idx' },
    { label: '物资编码', key: 'code' },
    { label: '物资名称', key: 'name' },
    { label: '规格型号', key: 'specification' },
    { label: '单位', key: 'unit' },
  ];

  let pages: string[] = [];

  for (let p = 0; p < PAGE_COUNT; p++) {
    const slice = data.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);

    const rowsHtml = slice.map((row: any, i: number) => {
      const globalIdx = i + p * ROWS_PER_PAGE + 1;
      return `
  <tr style="height:22px;">
    ${cols.map(c => {
      const val = c.key === '_idx' ? globalIdx : (row[c.key] ?? '-');
      return `<td style="border:1px solid #333;padding:2px 4px;font-size:12px;text-align:center;overflow:hidden;text-overflow:ellipsis;">${val}</td>`;
    }).join('')}
  </tr>`;
    }).join('');

    pages.push(`
<table style="width:100%; border-collapse:collapse; border:1px solid #333; table-layout:fixed;">
  <tr>
    <td colspan="${cols.length}" style="border:none;font-size:18px;font-weight:bold;text-align:center;padding:8px 0;">
      两江校区后勤物资表
    </td>
  </tr>
  <tr>
    <td colspan="${cols.length}" style="border:none;font-size:12px;text-align:right;padding:4px 8px;">
      打印时间：${PRINT_TIME}
    </td>
  </tr>
  <tr style="background:#d9e8f7;">
    ${cols.map(c => `<th style="border:1px solid #333;padding:5px 4px;font-size:12px;text-align:center;">${c.label}</th>`).join('')}
  </tr>
  ${rowsHtml}
  <tr><td colspan="${cols.length}" style="border:none;height:8px;"></td></tr>
  <tr>
    <td colspan="${cols.length}" style="border:1px solid #333;padding:4px 6px;">
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;white-space:nowrap;width:33.33%;">经办人：________________</td>
          <td style="padding:4px 0;white-space:nowrap;width:33.33%;">审核人：________________</td>
          <td style="padding:4px 0;white-space:nowrap;width:33.34%;">分管领导签字：________________</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
${p < PAGE_COUNT - 1 ? '<div style="page-break-after:always;"></div>' : ''}`);
  }

  const css = `
<style>
@media print {
  @page { size: A4 portrait; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
body { font-family: "SimSun", "宋体", serif; margin: 0; padding: 0; background: #fff; }
table { page-break-inside: avoid; }
</style>`;

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>两江校区后勤物资表</title>${css}</head><body style="margin:0;padding:0;">${pages.join('\n')}</body></html>`);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
  }, 600);
}

// ============================================
// 导出函数
// ============================================

export interface CsvColumn {
  key: string;
  label: string;
}

/**
 * 下载 CSV 模板（空模板，仅含表头）
 */
export function downloadTemplate(columns: CsvColumn[], filename: string): void {
  if (!columns || columns.length === 0) {
    console.error('[downloadTemplate] columns 不能为空');
    throw new Error('导出列定义不能为空');
  }
  if (!filename) {
    console.error('[downloadTemplate] filename 不能为空');
    throw new Error('文件名不能为空');
  }

  try {
    const header = columns.map(c => c.label).join(',');
    const csvContent = `${CSV_BOM}${header}\n`;
    const blob = new Blob([csvContent], { type: CSV_MIME_TYPE });
    safeDownload(blob, `${filename}.csv`);
  } catch (error) {
    console.error('[downloadTemplate] 下载失败:', error);
    throw error;
  }
}

/**
 * 下载 CSV 数据
 * @param data 数据数组
 * @param columns 列定义
 * @param filename 文件名（不含扩展名）
 */
export function downloadCSV(data: any[], columns: CsvColumn[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('[downloadCSV] 数据为空，无需导出');
    return;
  }
  if (!columns || columns.length === 0) {
    console.error('[downloadCSV] columns 不能为空');
    throw new Error('导出列定义不能为空');
  }
  if (!filename) {
    console.error('[downloadCSV] filename 不能为空');
    throw new Error('文件名不能为空');
  }

  try {
    // 限制导出行数，防止内存溢出
    const exportData = data.length > MAX_CSV_ROWS ? data.slice(0, MAX_CSV_ROWS) : data;
    if (data.length > MAX_CSV_ROWS) {
      console.warn(`[downloadCSV] 数据量(${data.length})超过最大限制(${MAX_CSV_ROWS})，已截断`);
    }

    const header = columns.map(c => c.label).join(',');
    const rows = exportData.map(row =>
      columns
        .map(col => {
          const value = row[col.key];
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return escapeCsvInjection(str);
        })
        .join(',')
    );

    const csvContent = `${CSV_BOM}${header}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: CSV_MIME_TYPE });
    safeDownload(blob, `${filename}.csv`);
  } catch (error) {
    console.error('[downloadCSV] 下载失败:', error);
    throw error;
  }
}

// ============================================
// 解析函数
// ============================================

/**
 * 解析 CSV 文本为二维字符串数组
 * 支持：引号包裹、双引号转义、换行符、BOM 自动去除
 * 注意：大文件建议使用流式解析，此函数适用于中小文件
 */
export function parseCSV(text: string): string[][] {
  if (!text || typeof text !== 'string') {
    console.error('[parseCSV] text 不能为空');
    throw new Error('CSV 文本不能为空');
  }

  // 去除 UTF-8 BOM
  let csvText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        // 双引号转义："" 表示一个 " 字符
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          currentValue += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentValue += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentValue);
        currentValue = '';
        i++;
      } else if (char === '\r') {
        // 处理 \r\n 或 \r
        currentRow.push(currentValue);
        if (currentRow.some(cell => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
        if (i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else if (char === '\n') {
        currentRow.push(currentValue);
        if (currentRow.some(cell => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
        i++;
      } else {
        currentValue += char;
        i++;
      }
    }
  }

  // 处理最后一行
  currentRow.push(currentValue);
  if (currentRow.some(cell => cell.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * 将 CSV 文本转换为对象数组
 * @param csvText CSV 文本
 * @param columns 列定义（key 对应 CSV 表头的映射）
 */
export function csvToObjects(csvText: string, columns: CsvColumn[]): any[] {
  if (!csvText) {
    console.error('[csvToObjects] csvText 不能为空');
    throw new Error('CSV 内容不能为空');
  }
  if (!columns || columns.length === 0) {
    console.error('[csvToObjects] columns 不能为空');
    throw new Error('列定义不能为空');
  }

  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    console.warn('[csvToObjects] CSV 数据行不足（至少需要表头+1行数据）');
    return [];
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row, rowIndex) => {
    const obj: any = {};
    columns.forEach((col, index) => {
      const rawValue = row[index] || '';
      // 去除可能的注入转义前缀（单引号）
      const value = rawValue.startsWith("'") ? rawValue.slice(1) : rawValue;
      // 尝试转换为数字
      const num = Number(value);
      obj[col.key] = value === '' ? null : (!isNaN(num) && value.trim() !== '' ? num : value);
    });
    return obj;
  });
}

// ============================================
// 文件导入函数
// ============================================

export interface UploadResult {
  success: boolean;
  data?: any[];
  error?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * 读取并解析上传的 CSV/Excel 文件
 * @param file 上传的文件对象
 * @param columns 列定义
 * @returns 解析结果
 */
export async function parseUploadFile(file: File, columns: CsvColumn[]): Promise<UploadResult> {
  if (!file) {
    return { success: false, error: '未选择文件' };
  }
  if (!columns || columns.length === 0) {
    return { success: false, error: '列定义不能为空' };
  }

  // 文件大小检查
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const msg = `文件大小(${(file.size / 1024 / 1024).toFixed(2)}MB)超过限制(${MAX_FILE_SIZE_MB}MB)`;
    console.error('[parseUploadFile]', msg);
    return { success: false, error: msg };
  }

  const fileName = file.name.toLowerCase();

  try {
    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      const data = csvToObjects(text, columns);
      return {
        success: true,
        data,
        fileName: file.name,
        fileSize: file.size,
      };
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Excel 解析需要引入 xlsx 库，这里返回提示
      const msg = '暂不支持 Excel 文件，请先将文件另存为 CSV 格式后上传';
      console.warn('[parseUploadFile]', msg);
      return { success: false, error: msg };
    }

    return { success: false, error: '不支持的文件格式，请上传 .csv 文件' };
  } catch (error: any) {
    console.error('[parseUploadFile] 解析失败:', error);
    return { success: false, error: `文件解析失败：${error?.message || '未知错误'}` };
  }
}

/**
 * 触发文件选择对话框并读取文件
 * @param columns 列定义
 * @param accept 可接受的文件类型，默认 '.csv'
 * @returns 解析结果
 */
export async function uploadAndParse(
  columns: CsvColumn[],
  accept: string = '.csv'
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = async (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) {
        resolve({ success: false, error: '未选择文件' });
        return;
      }
      const result = await parseUploadFile(file, columns);
      resolve(result);
    };

    input.oncancel = () => {
      resolve({ success: false, error: '已取消选择文件' });
    };

    input.click();
  });
}
