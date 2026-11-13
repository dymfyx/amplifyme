/**
 * 本地存档（ArchiveDrawer）的中文文案。
 * 与仓库其他词典一致：key 就是英文原文，由 i18n 的 t() 直接查找。
 */
export const zhArchive: Record<string, string> = {
  // 抽屉框架
  ARCHIVE: '存档',
  'ARCHIVE ({count})': '存档（{count}）',
  'Session archive': '存档',
  'Saved sessions': '保存记录',
  CLOSE: '关闭',

  // 工具条
  EXPORT: '导出',
  IMPORT: '导入',
  'LINK ARCHIVE FILE': '链接存档文件',
  'SHARED FILE': '共享文件',
  UNLINK: '取消链接',

  // 空态
  'No saved sessions yet — close a session and it lands here.':
    '还没有保存记录——结束一场会话后会自动出现在这里。',

  // 列表表头
  DATE: '日期',
  DESK: '台面',
  SCENARIO: '剧本',
  MIN: '分钟',
  'P&L': '盈亏',
  ALPHA: '超额',
  SCORE: '评分',

  // 台面
  Sales: '销售',
  'Market Maker': '做市商',

  // 详情字段
  'TOTAL P&L': '总盈亏',
  REALISED: '已实现',
  UNREALISED: '浮动',
  COMMISSION: '佣金',
  BENCHMARK: '基准',
  COMPOSITE: '综合分',
  PERCENTILE: '百分位',
  TRADES: '成交',
  QUOTES: '报价',
  INFORMED: '知情单',
  'PICKED OFF': '成交即被套',
  MISSED: '错过头条',
  'WORST DRAWDOWN': '最大回撤',

  // 底部操作
  'DELETE THIS SESSION': '删除这条记录',
  'CLEAR ALL': '全部清空',
  'CLICK AGAIN TO CLEAR': '再点一次清空',
}
