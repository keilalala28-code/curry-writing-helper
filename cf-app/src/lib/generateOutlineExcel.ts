import type { OutlineResult } from './api'

// ─── Color palette ────────────────────────────────────────────────────────────
const DARK_BLUE  = 'FF2F5496'
const MED_BLUE   = 'FF2E75B6'
const LIGHT_BLUE = 'FFBDD7EE'
const PURPLE     = 'FF7030A0'
const PURPLE_LT  = 'FFE4DFEC'
const TEAL       = 'FF00B050'
const TEAL_LT    = 'FFE2EFDA'
const GREEN_DK   = 'FF375623'
const YELLOW_LT  = 'FFFFEB9C'
const RED_LT     = 'FFFFC7CE'
const SUMMARY_BG = 'FFD9E1F2'
const WHITE      = 'FFFFFFFF'
const BLACK      = 'FF000000'

const THIN_BORDER = {
  top: { style: 'thin' as const }, left: { style: 'thin' as const },
  bottom: { style: 'thin' as const }, right: { style: 'thin' as const },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleHeader(cell: any, bg: string, fg = WHITE, sz = 11, bold = true) {
  cell.font = { bold, size: sz, color: { argb: fg } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = THIN_BORDER
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleContent(cell: any, align = 'left') {
  cell.font = { size: 11 }
  cell.alignment = { horizontal: align, vertical: 'top', wrapText: true }
  cell.border = THIN_BORDER
}

export async function generateOutlineExcel(result: OutlineResult): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')

  // ─── Column widths ──────────────────────────────────────────────────────────
  ws.columns = [
    { width: 9  }, // A - labels
    { width: 40 }, // B - 铺垫第一阶段（宽）
    { width: 18 }, // C - 转折点
    { width: 22 }, // D - 情绪点①
    { width: 40 }, // E - 铺垫第二阶段（宽）
    { width: 18 }, // F - 转折点
    { width: 22 }, // G - 情绪点②
    { width: 36 }, // H - 铺垫第三阶段（宽）
    { width: 18 }, // I - 转折点
    { width: 22 }, // J - 情绪点③
  ]

  // ─── Row 1: Title ───────────────────────────────────────────────────────────
  ws.addRow([])
  ws.getRow(1).height = 42
  ws.mergeCells('A1:J1')
  const title = ws.getCell('A1')
  title.value = '情绪结构思路拆解'
  styleHeader(title, DARK_BLUE, WHITE, 18)

  // ─── Row 2: Summary ─────────────────────────────────────────────────────────
  ws.addRow([])
  ws.getRow(2).height = 45
  ws.mergeCells('A2:J2')
  const summary = ws.getCell('A2')
  summary.value = `一句话梗概：${result.summary}`
  summary.font = { bold: true, size: 13 }
  summary.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } }
  summary.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  summary.border = THIN_BORDER

  // ─── Row 3–4: 结构（起承转合）───────────────────────────────────────────────
  ws.addRow([])
  ws.addRow([])
  ws.getRow(3).height = 22
  ws.getRow(4).height = 65

  ws.mergeCells('A3:A4')
  styleHeader(ws.getCell('A3'), MED_BLUE, WHITE, 11)
  ws.getCell('A3').value = '结构'

  ws.mergeCells('B3:D3')
  styleHeader(ws.getCell('B3'), LIGHT_BLUE, BLACK)
  ws.getCell('B3').value = '起'

  ws.mergeCells('E3:G3')
  styleHeader(ws.getCell('E3'), LIGHT_BLUE, BLACK)
  ws.getCell('E3').value = '承'

  ws.mergeCells('H3:I3')
  styleHeader(ws.getCell('H3'), LIGHT_BLUE, BLACK)
  ws.getCell('H3').value = '转'

  styleHeader(ws.getCell('J3'), LIGHT_BLUE, BLACK)
  ws.getCell('J3').value = '合'

  ws.mergeCells('B4:D4')
  styleContent(ws.getCell('B4'))
  ws.getCell('B4').value = result.structure.qi

  ws.mergeCells('E4:G4')
  styleContent(ws.getCell('E4'))
  ws.getCell('E4').value = result.structure.cheng

  ws.mergeCells('H4:I4')
  styleContent(ws.getCell('H4'))
  ws.getCell('H4').value = result.structure.zhuan

  styleContent(ws.getCell('J4'))
  ws.getCell('J4').value = result.structure.he

  // ─── Row 5–6: 事件流程（欲望/阻碍/行动/达成）──────────────────────────────
  ws.addRow([])
  ws.addRow([])
  ws.getRow(5).height = 22
  ws.getRow(6).height = 80

  ws.mergeCells('A5:A6')
  styleHeader(ws.getCell('A5'), MED_BLUE, WHITE, 11)
  ws.getCell('A5').value = '事件流程'

  ws.mergeCells('B5:D5')
  styleHeader(ws.getCell('B5'), LIGHT_BLUE, BLACK)
  ws.getCell('B5').value = '欲望'

  ws.mergeCells('E5:G5')
  styleHeader(ws.getCell('E5'), LIGHT_BLUE, BLACK)
  ws.getCell('E5').value = '阻碍'

  ws.mergeCells('H5:I5')
  styleHeader(ws.getCell('H5'), LIGHT_BLUE, BLACK)
  ws.getCell('H5').value = '行动'

  styleHeader(ws.getCell('J5'), LIGHT_BLUE, BLACK)
  ws.getCell('J5').value = '达成'

  ws.mergeCells('B6:D6')
  styleContent(ws.getCell('B6'))
  ws.getCell('B6').value = result.event_flow.desire

  ws.mergeCells('E6:G6')
  styleContent(ws.getCell('E6'))
  ws.getCell('E6').value = result.event_flow.obstacle.replace(/\\n/g, '\n')

  ws.mergeCells('H6:I6')
  styleContent(ws.getCell('H6'))
  ws.getCell('H6').value = result.event_flow.action.replace(/\\n/g, '\n')

  styleContent(ws.getCell('J6'))
  ws.getCell('J6').value = result.event_flow.achieve

  // ─── Row 7–10: 爽点元素 ─────────────────────────────────────────────────────
  ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([])
  ws.getRow(7).height = 22
  ws.getRow(8).height = 22
  ws.getRow(9).height = 22
  ws.getRow(10).height = 70

  ws.mergeCells('A7:A10')
  styleHeader(ws.getCell('A7'), PURPLE, WHITE)
  ws.getCell('A7').value = '爽点元素'

  ws.mergeCells('B7:B9')
  styleHeader(ws.getCell('B7'), PURPLE, WHITE)
  ws.getCell('B7').value = '人物'

  ws.mergeCells('C7:D7')
  styleHeader(ws.getCell('C7'), PURPLE_LT, BLACK)
  ws.getCell('C7').value = '主角势力'

  ws.mergeCells('E7:J7')
  styleContent(ws.getCell('E7'))
  ws.getCell('E7').value = result.characters.protagonist

  ws.mergeCells('C8:D8')
  styleHeader(ws.getCell('C8'), PURPLE_LT, BLACK)
  ws.getCell('C8').value = '反派势力'

  ws.mergeCells('E8:J8')
  styleContent(ws.getCell('E8'))
  ws.getCell('E8').value = result.characters.antagonist

  ws.mergeCells('C9:D9')
  styleHeader(ws.getCell('C9'), PURPLE_LT, BLACK)
  ws.getCell('C9').value = '围观群众'

  ws.mergeCells('E9:J9')
  styleContent(ws.getCell('E9'))
  ws.getCell('E9').value = result.characters.bystanders

  ws.mergeCells('B10:D10')
  styleHeader(ws.getCell('B10'), PURPLE, WHITE)
  ws.getCell('B10').value = '情绪点要素、转折点'

  ws.mergeCells('E10:J10')
  styleContent(ws.getCell('E10'))
  ws.getCell('E10').value = result.emotion_elements.replace(/\\n/g, '\n')

  // ─── Row 11–12: 细纲 ────────────────────────────────────────────────────────
  ws.addRow([]); ws.addRow([])
  ws.getRow(11).height = 22
  ws.getRow(12).height = 300

  ws.mergeCells('A11:A12')
  styleHeader(ws.getCell('A11'), TEAL, WHITE)
  ws.getCell('A11').value = '细纲'

  const outlineHeaders = [
    ['B11', '铺垫情节（第一阶段）'], ['C11', '转折点'], ['D11', '情绪点①'],
    ['E11', '铺垫情节（第二阶段）'], ['F11', '转折点'], ['G11', '情绪点②'],
    ['H11', '铺垫情节（第三阶段）'], ['I11', '转折点'], ['J11', '情绪点③'],
  ]
  outlineHeaders.forEach(([addr, val]) => {
    styleHeader(ws.getCell(addr), TEAL_LT, BLACK)
    ws.getCell(addr).value = val
  })

  const [seg1, seg2, seg3] = result.outline
  const outlineContent: [string, string][] = [
    ['B12', seg1?.setup || ''], ['C12', seg1?.turning || ''], ['D12', seg1?.emotion || ''],
    ['E12', seg2?.setup || ''], ['F12', seg2?.turning || ''], ['G12', seg2?.emotion || ''],
    ['H12', seg3?.setup || ''], ['I12', seg3?.turning || ''], ['J12', seg3?.emotion || ''],
  ]
  outlineContent.forEach(([addr, val]) => {
    styleContent(ws.getCell(addr))
    ws.getCell(addr).value = val.replace(/\\n/g, '\n')
  })

  // ─── Row 13–14: 情绪折线 ─────────────────────────────────────────────────────
  ws.addRow([]); ws.addRow([])
  ws.getRow(13).height = 22
  ws.getRow(14).height = 90

  ws.mergeCells('A13:A14')
  styleHeader(ws.getCell('A13'), GREEN_DK, WHITE)
  ws.getCell('A13').value = '情绪'

  ws.mergeCells('B13:G13')
  styleHeader(ws.getCell('B13'), TEAL_LT, BLACK)
  ws.getCell('B13').value = '主线情绪折线图'

  ws.mergeCells('H13:I13')
  styleHeader(ws.getCell('H13'), YELLOW_LT, BLACK)
  ws.getCell('H13').value = '上行情绪'

  styleHeader(ws.getCell('J13'), RED_LT, BLACK)
  ws.getCell('J13').value = '下行情绪'

  ws.mergeCells('B14:G14')
  styleContent(ws.getCell('B14'), 'center')
  ws.getCell('B14').value = ''

  ws.mergeCells('H14:I14')
  styleContent(ws.getCell('H14'))
  ws.getCell('H14').value = result.emotion_arc.up.replace(/\\n/g, '\n')

  styleContent(ws.getCell('J14'))
  ws.getCell('J14').value = result.emotion_arc.down.replace(/\\n/g, '\n')

  // ─── Generate & download ─────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '情绪结构细纲.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
