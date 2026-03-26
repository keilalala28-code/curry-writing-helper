import type { OutlineResult } from './api'

const TEAL       = 'FF00B050'
const TEAL_LT    = 'FFE2EFDA'
const RED_LT     = 'FFFFC7CE'
const YELLOW_LT  = 'FFFFEB9C'
const WHITE      = 'FFFFFFFF'
const BLACK      = 'FF000000'
const THIN_BORDER = {
  top: { style: 'thin' as const }, left: { style: 'thin' as const },
  bottom: { style: 'thin' as const }, right: { style: 'thin' as const },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sh(cell: any, bg: string, fg = WHITE, sz = 11, bold = true) {
  cell.font = { bold, size: sz, color: { argb: fg } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = THIN_BORDER
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sc(cell: any) {
  cell.font = { size: 11 }
  cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  cell.border = THIN_BORDER
}

export async function generateOutlineExcel(result: OutlineResult): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('细纲')

  ws.columns = [
    { width: 8  }, // A label
    { width: 45 }, // B 铺垫1
    { width: 20 }, // C 转折1
    { width: 22 }, // D 情绪1
    { width: 45 }, // E 铺垫2
    { width: 20 }, // F 转折2
    { width: 22 }, // G 情绪2
    { width: 45 }, // H 铺垫3
    { width: 20 }, // I 转折3
    { width: 22 }, // J 情绪3
  ]

  // Row 1: headers
  ws.addRow([])
  ws.getRow(1).height = 22
  ws.mergeCells('A1:A2'); sh(ws.getCell('A1'), TEAL)
  ws.getCell('A1').value = '细纲'
  sh(ws.getCell('B1'), TEAL_LT, BLACK); ws.getCell('B1').value = '铺垫情节（第一阶段）'
  sh(ws.getCell('C1'), RED_LT, BLACK);  ws.getCell('C1').value = '转折点'
  sh(ws.getCell('D1'), YELLOW_LT, BLACK); ws.getCell('D1').value = '情绪点①'
  sh(ws.getCell('E1'), TEAL_LT, BLACK); ws.getCell('E1').value = '铺垫情节（第二阶段）'
  sh(ws.getCell('F1'), RED_LT, BLACK);  ws.getCell('F1').value = '转折点'
  sh(ws.getCell('G1'), YELLOW_LT, BLACK); ws.getCell('G1').value = '情绪点②'
  sh(ws.getCell('H1'), TEAL_LT, BLACK); ws.getCell('H1').value = '铺垫情节（第三阶段）'
  sh(ws.getCell('I1'), RED_LT, BLACK);  ws.getCell('I1').value = '转折点'
  sh(ws.getCell('J1'), YELLOW_LT, BLACK); ws.getCell('J1').value = '情绪点③'

  // Row 2: content
  ws.addRow([])
  ws.getRow(2).height = 400

  const [s1, s2, s3] = result.outline
  const cells: [string, string][] = [
    ['B2', s1?.setup || ''], ['C2', s1?.turning || ''], ['D2', s1?.emotion || ''],
    ['E2', s2?.setup || ''], ['F2', s2?.turning || ''], ['G2', s2?.emotion || ''],
    ['H2', s3?.setup || ''], ['I2', s3?.turning || ''], ['J2', s3?.emotion || ''],
  ]
  cells.forEach(([addr, val]) => { sc(ws.getCell(addr)); ws.getCell(addr).value = val })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = '情绪结构细纲.xlsx'
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
