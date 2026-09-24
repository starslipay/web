/**
 * Grafana Explore 深链接生成器（模板）
 * 复制到项目中按需调整。核心规则：
 * 1. expr/query 放原始字符串，JSON.stringify 自动转义引号
 * 2. 只对整个 panes JSON 做一次 encodeURIComponent，禁止预先编码 expr
 */

const GRAFANA_BASE = 'http://43.136.84.124:31000/explore'

const LOKI_UID = 'afwwzpsybzsw0a'
const TEMPO_UID = 'tempo'
const PROM_UID = 'prometheus'

const MODULES = ['pay_gate', 'trade_itg', 'user_mgr', 'account_mgr', 'order_mgr', 'trade_id_mgr']
const RPC_MODULES = MODULES.filter((m) => m !== 'pay_gate')
const CONTAINER_PATTERN = MODULES.join('|')

const HTTP_METRIC = 'http_server_requests_code_total'
const RPC_METRIC = 'rpc_server_requests_code_total'

const buildExploreUrl = (panes: Record<string, unknown>): string =>
  `${GRAFANA_BASE}?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}&orgId=1`

/** 从 W3C traceparent（00-traceId-parentId-01）提取 trace-id */
export const getTraceId = (traceparent: string): string => {
  const parts = traceparent.split('-')
  return parts.length >= 2 ? parts[1] : traceparent
}

/** Loki：按 trace-id 查全容器链路日志 */
export const buildLokiLogUrl = (traceparent: string, rangeFrom = 'now-30m'): string => {
  const traceId = getTraceId(traceparent)
  return buildExploreUrl({
    hzj: {
      datasource: LOKI_UID,
      queries: [{
        refId: 'A',
        expr: `{container=~"${CONTAINER_PATTERN}"} |= "${traceId}"`,
        queryType: 'range',
        datasource: { type: 'loki', uid: LOKI_UID },
        editorMode: 'code',
      }],
      range: { from: rangeFrom, to: 'now' },
    },
  })
}

/** Tempo：TraceQL（pay_gate 服务 + trace:id）与裸 trace-id 双 pane */
export const buildTempoTraceUrl = (traceparent: string, rangeFrom = 'now-1h'): string => {
  const traceId = getTraceId(traceparent)
  const range = { from: rangeFrom, to: 'now' }
  return buildExploreUrl({
    hzj: {
      datasource: TEMPO_UID,
      queries: [{
        refId: 'A',
        datasource: { type: 'tempo', uid: TEMPO_UID },
        queryType: 'traceql',
        limit: 20,
        tableType: 'traces',
        query: `{ .service.name = "pay_gate" && trace:id = "${traceId}" }`,
        filters: [{ id: 'd84686bf', operator: '=', scope: 'span' }],
      }],
      range,
    },
    b9r: {
      datasource: TEMPO_UID,
      queries: [{
        refId: 'A',
        query: traceId,
        queryType: 'traceql',
        limit: 20,
        tableType: 'traces',
      }],
      range,
    },
  })
}

const promQuery = (refId: string, expr: string, legendFormat = '{{module}}') => ({
  refId,
  expr,
  range: true,
  datasource: { type: 'prometheus', uid: PROM_UID },
  editorMode: 'builder',
  legendFormat,
  useBackend: false,
  disableTextWrap: false,
  fullMetaSearch: false,
  includeNullMetadata: false,
})

const getMetricName = (moduleName: string): string =>
  moduleName === 'pay_gate' ? HTTP_METRIC : RPC_METRIC

// HTTP 用 path，RPC 用 method 作为接口维度标签
const getEndpointLabel = (moduleName: string): string =>
  moduleName === 'pay_gate' ? 'path' : 'method'

/** rpm = 每分钟请求数（默认，整数）；qps = rate 每秒平均（低流量为小数属正常） */
export type RateMode = 'rpm' | 'qps'

// 按指定维度聚合
const wrapRateBy = (selector: string, byLabels: string, mode: RateMode): string =>
  mode === 'qps'
    ? `sum by (${byLabels}) (rate(${selector}[1m]))`
    : `round(sum by (${byLabels}) (increase(${selector}[1m])))`

/**
 * Prometheus：单模块请求速率
 * @param endpointFilter 接口路径正则筛选（留空=按接口名拆分所有接口；有值=筛选该接口按 code 拆分成功/失败）
 */
export const buildModuleRateUrl = (
  moduleName: string,
  mode: RateMode = 'rpm',
  endpointFilter = '',
): string => {
  const metric = getMetricName(moduleName)
  const endpointLabel = getEndpointLabel(moduleName)
  const filter = endpointFilter.trim()
  const expr = filter
    ? wrapRateBy(`${metric}{module="${moduleName}", ${endpointLabel}=~"${filter}"}`, 'code', mode)
    : wrapRateBy(`${metric}{module="${moduleName}"}`, endpointLabel, mode)
  const legend = filter ? '{{code}}' : `{{${endpointLabel}}}`
  return buildExploreUrl({
    f82: {
      datasource: PROM_UID,
      queries: [promQuery('A', expr, legend)],
      range: { from: 'now-1h', to: 'now' },
    },
  })
}

/**
 * Prometheus：全部模块请求速率（A: pay_gate HTTP，B: 其余 RPC）
 * 无筛选按 module 聚合；有筛选分别用 path/method 过滤后按 module 聚合
 */
export const buildAllModulesRateUrl = (mode: RateMode = 'rpm', endpointFilter = ''): string => {
  const filter = endpointFilter.trim()
  const httpSelector = filter
    ? `${HTTP_METRIC}{module="pay_gate", path=~"${filter}"}`
    : `${HTTP_METRIC}{module="pay_gate"}`
  const rpcSelector = filter
    ? `${RPC_METRIC}{module=~"${RPC_MODULES.join('|')}", method=~"${filter}"}`
    : `${RPC_METRIC}{module=~"${RPC_MODULES.join('|')}"}`
  return buildExploreUrl({
    f82: {
      datasource: PROM_UID,
      queries: [
        promQuery('A', wrapRateBy(httpSelector, 'module', mode), '{{module}}'),
        promQuery('B', wrapRateBy(rpcSelector, 'module', mode), '{{module}}'),
      ],
      range: { from: 'now-1h', to: 'now' },
    },
  })
}
