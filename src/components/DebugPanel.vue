<script setup lang="ts">
import { useDebugStore } from '@/stores/debug'
import { X, Trash2, Copy, Check, ChevronDown, ChevronRight, Clock, Zap, AlertCircle, ExternalLink, Network, BarChart3, Search, GitBranch, ScrollText } from 'lucide-vue-next'
import { ref } from 'vue'

const debugStore = useDebugStore()

const expandedLogs = ref<Set<number>>(new Set())
const copiedId = ref<number | null>(null)

// Grafana Loki 日志查询配置
const GRAFANA_BASE = 'http://43.136.84.124:31000/explore'
const LOKI_DATASOURCE_UID = 'afwwzpsybzsw0a'
const CONTAINER_PATTERN = 'pay_gate|trade_itg|user_mgr|account_mgr|order_mgr|trade_ig_mgr'

// 根据 trace-id 生成 Grafana Loki 日志查询链接
const buildLogQueryUrl = (traceparent: string): string => {
  const traceId = getTraceId(traceparent)
  // 原始查询表达式（不做 URL 编码，由 JSON.stringify 处理引号转义）
  const rawExpr = `{container=~"${CONTAINER_PATTERN}"} |= "${traceId}"`
  const panes = {
    hzj: {
      datasource: LOKI_DATASOURCE_UID,
      queries: [{
        refId: 'A',
        expr: rawExpr,
        queryType: 'range',
        datasource: { type: 'loki', uid: LOKI_DATASOURCE_UID },
        editorMode: 'code',
      }],
      range: { from: 'now-30m', to: 'now' },
    },
  }
  // 整体 URL 编码一次（与 Grafana Explore 链接格式一致）
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

// Grafana Tempo 链路追踪配置
const TEMPO_DATASOURCE_UID = 'tempo'
const PAY_GATE_SERVICE = 'pay_gate'

// 根据 trace-id 生成 Grafana Tempo 链路查询链接
const buildTempoTraceUrl = (traceparent: string): string => {
  const traceId = getTraceId(traceparent)
  const traceqlQuery = `{ .service.name = "${PAY_GATE_SERVICE}" && trace:id = "${traceId}" }`
  const panes = {
    hzj: {
      datasource: TEMPO_DATASOURCE_UID,
      queries: [{
        refId: 'A',
        datasource: { type: 'tempo', uid: TEMPO_DATASOURCE_UID },
        queryType: 'traceql',
        limit: 20,
        tableType: 'traces',
        query: traceqlQuery,
        filters: [{ id: 'd84686bf', operator: '=', scope: 'span' }],
      }],
      range: { from: 'now-1h', to: 'now' },
    },
    b9r: {
      datasource: TEMPO_DATASOURCE_UID,
      queries: [{
        query: traceId,
        queryType: 'traceql',
        refId: 'A',
        limit: 20,
        tableType: 'traces',
      }],
      range: { from: 'now-1h', to: 'now' },
    },
  }
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

// Grafana Prometheus 监控配置
const PROMETHEUS_DATASOURCE_UID = 'prometheus'
// pay_gate 是 HTTP 网关，其余模块为 RPC 服务
const HTTP_METRIC = 'http_server_requests_code_total'
const RPC_METRIC = 'rpc_server_requests_code_total'
// go-zero 耗时指标（Histogram，单位毫秒，子指标 _sum/_count/_bucket）
const HTTP_DURATION_METRIC = 'http_server_requests_duration_ms'
const RPC_DURATION_METRIC = 'rpc_server_requests_duration_ms'
// 自定义业务错误码指标（所有模块统一上报，标签: service/method/code/result）
const BIZ_CODE_METRIC = 'pay_biz_code_total'
const MODULES = ['pay_gate', 'trade_itg', 'user_mgr', 'account_mgr', 'order_mgr', 'trade_ig_mgr']
const RPC_MODULES = MODULES.filter(m => m !== 'pay_gate')

type MetricDim = 'requests' | 'errors' | 'avgLatency' | 'maxLatency'
const METRIC_DIMS: { key: MetricDim; label: string; desc: string }[] = [
  { key: 'requests', label: '请求数', desc: '每分钟/每秒请求数' },
  { key: 'errors', label: '错误码', desc: '按状态码拆分请求量' },
  { key: 'avgLatency', label: '平均耗时', desc: 'avg(duration_sum / duration_count) 毫秒' },
  { key: 'maxLatency', label: '最高耗时', desc: 'P99 分位耗时 毫秒' },
]

const metricsExpanded = ref(true)
// 速率口径：rpm = 每分钟请求数（默认，整数直观），qps = 每秒请求数 rate(...[1m])（低流量下为小数，属正常）
const rateMode = ref<'rpm' | 'qps'>('rpm')
// 指标维度：请求数 / 错误码 / 平均耗时 / 最高耗时
const metricDim = ref<MetricDim>('requests')
// 接口筛选（支持正则），留空表示查看所有接口；HTTP 用 path，RPC 用 method
const endpointFilter = ref('')

const toggleMetrics = () => {
  metricsExpanded.value = !metricsExpanded.value
}

// ===== 批量 Trace 查询 =====
// 通过模块名（resource.service.name）和/或接口名（span name）批量查询 trace 记录
const traceSearchExpanded = ref(true)
// 模块名筛选：对应 TraceQL 的 resource.service.name，支持从 MODULES 中快速选择或手动输入
const traceModuleFilter = ref('')
// 接口名筛选：对应 TraceQL 的 span name，支持正则匹配（HTTP 用 path，RPC 用 method）
const traceEndpointFilter = ref('')
// 仅查看包含错误 span 的 trace
const traceErrorOnly = ref(false)
// trace-id 筛选：精确匹配指定 trace
const traceIdFilter = ref('')

// 根据当前筛选条件生成 TraceQL 查询表达式
const buildTraceSearchQuery = (): string => {
  const conditions: string[] = []
  const module = traceModuleFilter.value.trim()
  const endpoint = traceEndpointFilter.value.trim()
  const traceId = traceIdFilter.value.trim()

  if (module) {
    conditions.push(`resource.service.name = "${module}"`)
  }
  if (endpoint) {
    // 接口名支持正则匹配
    conditions.push(`name =~ "${endpoint}"`)
  }
  if (traceErrorOnly.value) {
    conditions.push(`status = error`)
  }

  if (conditions.length === 0) {
    return `{ }`
  }
  return `{ ${conditions.join(' && ')} }`
}

// 生成 Grafana Tempo 批量 trace 查询链接
const buildTraceSearchUrl = (): string => {
  const traceId = traceIdFilter.value.trim()

  // 如果有 trace-id，优先使用 trace-id 直接查询（精确查找单条 trace）
  if (traceId) {
    const panes = {
      traceSearch: {
        datasource: TEMPO_DATASOURCE_UID,
        queries: [{
          query: traceId,
          queryType: 'traceql',
          refId: 'A',
          limit: 20,
          tableType: 'traces',
        }],
        range: { from: 'now-1h', to: 'now' },
      },
    }
    const encodedPanes = encodeURIComponent(JSON.stringify(panes))
    return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
  }

  // 否则使用 TraceQL 条件查询
  const query = buildTraceSearchQuery()
  const panes = {
    traceSearch: {
      datasource: TEMPO_DATASOURCE_UID,
      queries: [{
        refId: 'A',
        datasource: { type: 'tempo', uid: TEMPO_DATASOURCE_UID },
        queryType: 'traceql',
        limit: 20,
        tableType: 'traces',
        query: query,
      }],
      range: { from: 'now-1h', to: 'now' },
    },
  }
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

// ===== 批量日志查询 =====
// 通过模块名、接口名、错误码、user_id 等条件批量查询 Loki 日志
const logSearchExpanded = ref(true)
// 模块名筛选：对应 Loki 的 container 标签，支持从 MODULES 中快速选择或手动输入
const logModuleFilter = ref('')
// 接口名筛选：日志行内容包含该接口路径（支持正则，用 |~ 匹配）
const logEndpointFilter = ref('')
// 错误码筛选：日志行内容包含该错误码
const logErrorCodeFilter = ref('')
// user_id 筛选：日志行内容包含该 user_id
const logUserIdFilter = ref('')
// trace-id 筛选：日志行内容包含该 trace-id
const logTraceIdFilter = ref('')

// 根据当前筛选条件生成 LogQL 查询表达式
const buildLogSearchQuery = (): string => {
  const module = logModuleFilter.value.trim()
  const endpoint = logEndpointFilter.value.trim()
  const errorCode = logErrorCodeFilter.value.trim()
  const userId = logUserIdFilter.value.trim()
  const traceId = logTraceIdFilter.value.trim()

  // Stream selector：按 container 标签筛选模块
  let streamSelector: string
  if (module) {
    streamSelector = `{container="${module}"}`
  } else {
    streamSelector = `{container=~"${CONTAINER_PATTERN}"}`
  }

  // Line filter expressions：按行内容筛选
  const filters: string[] = []
  if (traceId) {
    filters.push(`|= "${traceId}"`)
  }
  if (endpoint) {
    // 接口名用正则匹配，兼容 path 和 method
    filters.push(`|~ "${endpoint}"`)
  }
  if (errorCode) {
    filters.push(`|= "${errorCode}"`)
  }
  if (userId) {
    filters.push(`|= "${userId}"`)
  }

  return `${streamSelector}${filters.length > 0 ? ' ' + filters.join(' ') : ''}`
}

// 生成 Grafana Loki 批量日志查询链接
const buildLogSearchUrl = (): string => {
  const expr = buildLogSearchQuery()
  const panes = {
    logSearch: {
      datasource: LOKI_DATASOURCE_UID,
      queries: [{
        refId: 'A',
        expr: expr,
        queryType: 'range',
        datasource: { type: 'loki', uid: LOKI_DATASOURCE_UID },
        editorMode: 'code',
      }],
      range: { from: 'now-1h', to: 'now' },
    },
  }
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

// 判断日志查询是否至少设置了一个筛选条件
const hasLogFilter = (): boolean => {
  return logModuleFilter.value.trim() !== ''
    || logEndpointFilter.value.trim() !== ''
    || logErrorCodeFilter.value.trim() !== ''
    || logUserIdFilter.value.trim() !== ''
}

// 根据模块名获取对应的计数指标名
const getMetricName = (moduleName: string): string => {
  return moduleName === 'pay_gate' ? HTTP_METRIC : RPC_METRIC
}

// 根据模块名获取对应的耗时指标名（Histogram）
const getDurationMetricName = (moduleName: string): string => {
  return moduleName === 'pay_gate' ? HTTP_DURATION_METRIC : RPC_DURATION_METRIC
}

// HTTP 用 path，RPC 用 method 作为接口维度标签
const getEndpointLabel = (moduleName: string): string => {
  return moduleName === 'pay_gate' ? 'path' : 'method'
}

// ===== 各维度的表达式生成 =====

// 请求数：有筛选按 code 拆分，无筛选按接口名拆分
const buildRequestsExpr = (moduleName: string): { expr: string; legend: string } => {
  const metric = getMetricName(moduleName)
  const label = getEndpointLabel(moduleName)
  const filter = endpointFilter.value.trim()
  const selector = filter
    ? `${metric}{module="${moduleName}", ${label}=~"${filter}"}`
    : `${metric}{module="${moduleName}"}`
  const by = filter ? 'code' : label
  const expr = rateMode.value === 'qps'
    ? `sum by (${by}) (rate(${selector}[1m]))`
    : `round(sum by (${by}) (increase(${selector}[1m])))`
  return { expr, legend: filter ? '{{code}}' : `{{${label}}}` }
}

// 错误码：使用自定义业务指标 pay_biz_code_total，按业务错误码(code)拆分
// code=0 表示成功，非 0 表示业务错误（如 100001006=token失效），全部展示
const buildErrorsExpr = (moduleName: string): { expr: string; legend: string } => {
  const filter = endpointFilter.value.trim()
  const selector = filter
    ? `${BIZ_CODE_METRIC}{service="${moduleName}", method=~"${filter}"}`
    : `${BIZ_CODE_METRIC}{service="${moduleName}"}`
  const expr = rateMode.value === 'qps'
    ? `sum by (code) (rate(${selector}[1m]))`
    : `round(sum by (code) (increase(${selector}[1m])))`
  return { expr, legend: '{{code}}' }
}

// 平均耗时：rate(metric_sum{...}) / rate(metric_count{...})，按接口聚合
// 注意：_sum/_count 是 metric 名的后缀，必须在花括号前面，如 http_server_requests_duration_ms_sum{...}
const buildAvgLatencyExpr = (moduleName: string): { expr: string; legend: string } => {
  const metric = getDurationMetricName(moduleName)
  const label = getEndpointLabel(moduleName)
  const filter = endpointFilter.value.trim()
  const by = filter ? 'code' : label
  const labelStr = filter ? `module="${moduleName}", ${label}=~"${filter}"` : `module="${moduleName}"`
  const expr = `sum by (${by}) (rate(${metric}_sum{${labelStr}}[1m])) / sum by (${by}) (rate(${metric}_count{${labelStr}}[1m]))`
  return { expr, legend: filter ? '{{code}}' : `{{${label}}}` }
}

// 最高耗时：P99 分位（histogram_quantile）
const buildMaxLatencyExpr = (moduleName: string): { expr: string; legend: string } => {
  const metric = getDurationMetricName(moduleName)
  const label = getEndpointLabel(moduleName)
  const filter = endpointFilter.value.trim()
  const by = filter ? 'code' : label
  // histogram_quantile 需要 le 标签在 by 中
  const selector = filter
    ? `${metric}_bucket{module="${moduleName}", ${label}=~"${filter}"}`
    : `${metric}_bucket{module="${moduleName}"}`
  const expr = `histogram_quantile(0.99, sum by (${by}, le) (rate(${selector}[1m])))`
  return { expr, legend: filter ? '{{code}}' : `{{${label}}}` }
}

// 统一入口：根据当前维度生成表达式和图例
const getModuleExpr = (moduleName: string): { expr: string; legend: string } => {
  switch (metricDim.value) {
    case 'requests': return buildRequestsExpr(moduleName)
    case 'errors': return buildErrorsExpr(moduleName)
    case 'avgLatency': return buildAvgLatencyExpr(moduleName)
    case 'maxLatency': return buildMaxLatencyExpr(moduleName)
  }
}

// 获取某模块完整的表达式（用于 tooltip 展示）
const getRateExpr = (moduleName: string): string => {
  return getModuleExpr(moduleName).expr
}

// 底部帮助文本
const getMetricsHelpText = (): string => {
  const filter = endpointFilter.value.trim()
  switch (metricDim.value) {
    case 'requests':
      return filter
        ? '筛选模式：命中接口按状态码(code)拆分'
        : rateMode.value === 'rpm'
          ? '按接口名拆分：round(sum by(path/method)(increase(metric[1m])))'
          : '按接口名拆分：sum by(path/method)(rate(metric[1m]))（低流量小数属正常）'
    case 'errors':
      return filter
        ? '筛选接口 + 业务错误码：pay_biz_code_total 按 code 拆分（含 code=0 成功）'
        : '业务错误码：pay_biz_code_total 按 code 拆分（0=成功, 100001006=token失效, 100000002=RPC错误）'
    case 'avgLatency':
      return filter
        ? '筛选接口：按 code 拆分，rate(sum)/rate(count) = 平均耗时(ms)'
        : '按接口拆分：rate(_sum)/rate(_count) = 每个接口的平均响应耗时(ms)'
    case 'maxLatency':
      return filter
        ? '筛选接口：按 code 拆分，histogram_quantile(0.99) = P99耗时(ms)'
        : '按接口拆分：histogram_quantile(0.99, ...) = P99最高耗时(ms)'
  }
}

// 构造 Prometheus 查询对象
const buildPromQuery = (refId: string, expr: string, legendFormat = '{{module}}') => ({
  refId,
  expr,
  range: true,
  datasource: { type: 'prometheus', uid: PROMETHEUS_DATASOURCE_UID },
  editorMode: 'code',
  legendFormat,
  useBackend: false,
  disableTextWrap: false,
  fullMetaSearch: false,
  includeNullMetadata: false,
})

// 根据模块名生成 Grafana Prometheus 监控链接
const buildPrometheusUrl = (moduleName: string): string => {
  const { expr, legend } = getModuleExpr(moduleName)
  const panes = {
    f82: {
      datasource: PROMETHEUS_DATASOURCE_UID,
      queries: [buildPromQuery('A', expr, legend)],
      range: { from: 'now-1h', to: 'now' },
    },
  }
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

// 生成所有模块的监控链接（A: pay_gate HTTP 指标，B: 其余模块 RPC 指标）
const buildAllModulesPrometheusUrl = (): string => {
  const filter = endpointFilter.value.trim()
  const httpLabel = 'path'
  const rpcLabel = 'method'

  let httpExpr: string, rpcExpr: string, legend: string

  if (metricDim.value === 'requests') {
    const by = filter ? 'module' : 'module'
    const httpSelector = filter ? `${HTTP_METRIC}{module="pay_gate", path=~"${filter}"}` : `${HTTP_METRIC}{module="pay_gate"}`
    const rpcSelector = filter ? `${RPC_METRIC}{module=~"${RPC_MODULES.join('|')}", method=~"${filter}"}` : `${RPC_METRIC}{module=~"${RPC_MODULES.join('|')}"}`
    httpExpr = rateMode.value === 'qps'
      ? `sum by (${by}) (rate(${httpSelector}[1m]))`
      : `round(sum by (${by}) (increase(${httpSelector}[1m])))`
    rpcExpr = rateMode.value === 'qps'
      ? `sum by (${by}) (rate(${rpcSelector}[1m]))`
      : `round(sum by (${by}) (increase(${rpcSelector}[1m])))`
    legend = '{{module}}'
  } else if (metricDim.value === 'errors') {
    // 使用自定义业务错误码指标 pay_biz_code_total，统一标签 service/method/code
    // 展示所有 code（包括 0=成功）
    const httpSelector = filter
      ? `${BIZ_CODE_METRIC}{service="pay_gate", method=~"${filter}"}`
      : `${BIZ_CODE_METRIC}{service="pay_gate"}`
    const rpcSelector = filter
      ? `${BIZ_CODE_METRIC}{service=~"${RPC_MODULES.join('|')}", method=~"${filter}"}`
      : `${BIZ_CODE_METRIC}{service=~"${RPC_MODULES.join('|')}"}`
    httpExpr = rateMode.value === 'qps'
      ? `sum by (service, code) (rate(${httpSelector}[1m]))`
      : `round(sum by (service, code) (increase(${httpSelector}[1m])))`
    rpcExpr = rateMode.value === 'qps'
      ? `sum by (service, code) (rate(${rpcSelector}[1m]))`
      : `round(sum by (service, code) (increase(${rpcSelector}[1m])))`
    legend = '{{service}} {{code}}'
  } else if (metricDim.value === 'avgLatency') {
    const httpLabelStr = filter ? `module="pay_gate", path=~"${filter}"` : `module="pay_gate"`
    const rpcLabelStr = filter ? `module=~"${RPC_MODULES.join('|')}", method=~"${filter}"` : `module=~"${RPC_MODULES.join('|')}"`
    httpExpr = `sum by (module) (rate(${HTTP_DURATION_METRIC}_sum{${httpLabelStr}}[1m])) / sum by (module) (rate(${HTTP_DURATION_METRIC}_count{${httpLabelStr}}[1m]))`
    rpcExpr = `sum by (module) (rate(${RPC_DURATION_METRIC}_sum{${rpcLabelStr}}[1m])) / sum by (module) (rate(${RPC_DURATION_METRIC}_count{${rpcLabelStr}}[1m]))`
    legend = '{{module}}'
  } else {
    // maxLatency: histogram_quantile(0.99) P99 分位
    const httpLabelStr = filter ? `module="pay_gate", path=~"${filter}"` : `module="pay_gate"`
    const rpcLabelStr = filter ? `module=~"${RPC_MODULES.join('|')}", method=~"${filter}"` : `module=~"${RPC_MODULES.join('|')}"`
    httpExpr = `histogram_quantile(0.99, sum by (module, le) (rate(${HTTP_DURATION_METRIC}_bucket{${httpLabelStr}}[1m])))`
    rpcExpr = `histogram_quantile(0.99, sum by (module, le) (rate(${RPC_DURATION_METRIC}_bucket{${rpcLabelStr}}[1m])))`
    legend = '{{module}}'
  }

  const panes = {
    f82: {
      datasource: PROMETHEUS_DATASOURCE_UID,
      queries: [
        buildPromQuery('A', httpExpr, legend),
        buildPromQuery('B', rpcExpr, legend),
      ],
      range: { from: 'now-1h', to: 'now' },
    },
  }
  const encodedPanes = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA_BASE}?schemaVersion=1&panes=${encodedPanes}&orgId=1`
}

const toggleExpand = (id: number) => {
  if (expandedLogs.value.has(id)) {
    expandedLogs.value.delete(id)
  } else {
    expandedLogs.value.add(id)
  }
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const copyJson = async (obj: any, id: number) => {
  try {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

const getMethodClass = (method: string) => {
  const classes: Record<string, string> = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  }
  return classes[method] || 'bg-gray-100 text-gray-700'
}

const getStatusClass = (statusCode: number | null) => {
  if (!statusCode) return 'text-gray-500'
  if (statusCode >= 200 && statusCode < 300) return 'text-green-600'
  if (statusCode >= 400 && statusCode < 500) return 'text-yellow-600'
  if (statusCode >= 500) return 'text-red-600'
  return 'text-gray-500'
}

// 从 W3C traceparent 中提取 trace-id 部分
const getTraceId = (traceparent: string): string => {
  const parts = traceparent.split('-')
  return parts.length >= 2 ? parts[1] : traceparent
}
</script>

<template>
  <div
    v-if="debugStore.isDebugMode"
    class="fixed top-0 right-0 h-full w-full sm:w-[600px] bg-gray-900 text-white shadow-2xl z-50 overflow-hidden flex flex-col animate-slide-in-right"
  >
    <div class="flex items-center justify-between p-4 border-b border-gray-700">
      <div class="flex items-center gap-2">
        <Zap class="w-5 h-5 text-yellow-500" />
        <span class="font-semibold">调试模式</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="debugStore.clearLogs"
          class="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="清空日志"
        >
          <Trash2 class="w-4 h-4 text-gray-400" />
        </button>
        <button
          @click="debugStore.toggleDebugMode"
          class="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="关闭调试"
        >
          <X class="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>

    <!-- 模块请求速率监控 -->
    <div class="border-b border-gray-700 bg-gray-800/80">
      <div
        @click="toggleMetrics"
        class="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <BarChart3 class="w-4 h-4 text-green-400" />
          <span class="text-xs font-medium text-green-400">模块请求速率</span>
        </div>
        <component
          :is="metricsExpanded ? ChevronDown : ChevronRight"
          class="w-4 h-4 text-gray-400"
        />
      </div>
      <div v-if="metricsExpanded" class="px-4 pb-3">
        <!-- 指标维度切换 -->
        <div class="inline-flex rounded-lg overflow-hidden border border-gray-600 mb-2 text-[11px]">
          <button
            v-for="dim in METRIC_DIMS"
            :key="dim.key"
            @click="metricDim = dim.key"
            :class="[
              'px-2.5 py-1 transition-colors',
              metricDim === dim.key ? 'bg-green-600 text-white' : 'bg-gray-700/60 text-gray-400 hover:text-white',
            ]"
            :title="dim.desc"
          >
            {{ dim.label }}
          </button>
        </div>
        <!-- 速率口径切换（仅请求数/错误码维度需要） -->
        <div v-if="metricDim === 'requests' || metricDim === 'errors'" class="inline-flex rounded-lg overflow-hidden border border-gray-600 mb-2 ml-2 text-[11px]">
          <button
            @click="rateMode = 'rpm'"
            :class="[
              'px-2.5 py-1 transition-colors',
              rateMode === 'rpm' ? 'bg-green-600 text-white' : 'bg-gray-700/60 text-gray-400 hover:text-white',
            ]"
          >
            每分钟
          </button>
          <button
            @click="rateMode = 'qps'"
            :class="[
              'px-2.5 py-1 transition-colors',
              rateMode === 'qps' ? 'bg-green-600 text-white' : 'bg-gray-700/60 text-gray-400 hover:text-white',
            ]"
          >
            每秒 QPS
          </button>
        </div>
        <!-- 接口筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <input
            v-model="endpointFilter"
            type="text"
            placeholder="按接口筛选（支持正则，如 /api/user/login 或 .*login.*），留空查看所有接口"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            v-if="endpointFilter"
            @click="endpointFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            :href="buildAllModulesPrometheusUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="px-2.5 py-1 rounded text-xs font-medium bg-green-600/20 text-green-300 border border-green-600/40 hover:bg-green-600/40 transition-colors"
            :title="`查看所有模块的${METRIC_DIMS.find(d => d.key === metricDim)?.label}`"
          >
            全部模块
          </a>
          <a
            v-for="mod in MODULES"
            :key="mod"
            :href="buildPrometheusUrl(mod)"
            target="_blank"
            rel="noopener noreferrer"
            class="px-2.5 py-1 rounded text-xs font-mono bg-gray-700/60 text-gray-300 border border-gray-600/40 hover:bg-gray-600 hover:text-white transition-colors"
            :title="`查看 ${mod} 的${METRIC_DIMS.find(d => d.key === metricDim)?.label}\n${getRateExpr(mod)}`"
          >
            {{ mod }}
          </a>
        </div>
        <p class="mt-2 text-[10px] text-gray-500 font-mono break-all">
          <template v-if="metricDim === 'requests'">
            pay_gate: {{ HTTP_METRIC }}(path) ｜ 其余: {{ RPC_METRIC }}(method)
          </template>
          <template v-else-if="metricDim === 'errors'">
            所有模块: {{ BIZ_CODE_METRIC }}(service/method/code/result) ｜ code=0成功, 非0=业务错误码
          </template>
          <template v-else>
            pay_gate: {{ HTTP_DURATION_METRIC }}(path) ｜ 其余: {{ RPC_DURATION_METRIC }}(method) ｜ 单位: ms
          </template>
          <br />
          {{ getMetricsHelpText() }}
        </p>
      </div>
    </div>

    <!-- 批量 Trace 查询 -->
    <div class="border-b border-gray-700 bg-gray-800/80">
      <div
        @click="traceSearchExpanded = !traceSearchExpanded"
        class="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <GitBranch class="w-4 h-4 text-orange-400" />
          <span class="text-xs font-medium text-orange-400">批量 Trace 查询</span>
        </div>
        <component
          :is="traceSearchExpanded ? ChevronDown : ChevronRight"
          class="w-4 h-4 text-gray-400"
        />
      </div>
      <div v-if="traceSearchExpanded" class="px-4 pb-3">
        <!-- 模块名筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">模块名</span>
          <input
            v-model="traceModuleFilter"
            type="text"
            list="trace-module-list"
            placeholder="如 pay_gate，留空查询所有模块"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-orange-500 transition-colors"
          />
          <datalist id="trace-module-list">
            <option v-for="mod in MODULES" :key="mod" :value="mod">{{ mod }}</option>
          </datalist>
          <button
            v-if="traceModuleFilter"
            @click="traceModuleFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 接口名筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">接口名</span>
          <input
            v-model="traceEndpointFilter"
            type="text"
            placeholder="span name，支持正则，如 .*login.* 或 /api/user/login"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            v-if="traceEndpointFilter"
            @click="traceEndpointFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- trace-id 筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">trace-id</span>
          <input
            v-model="traceIdFilter"
            type="text"
            placeholder="精确查询，填写 trace-id 后其他条件忽略"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-orange-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            v-if="traceIdFilter"
            @click="traceIdFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 仅错误 trace + 查询按钮 -->
        <div class="flex items-center justify-between mb-2">
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              v-model="traceErrorOnly"
              type="checkbox"
              class="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
            />
            <span class="text-[11px] text-gray-400">仅错误 trace</span>
          </label>
          <a
            :href="buildTraceSearchUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-orange-600/20 text-orange-300 border border-orange-600/40 hover:bg-orange-600/40 transition-colors"
            :title="`TraceQL: ${buildTraceSearchQuery()}`"
          >
            <Search class="w-3.5 h-3.5" />
            查询 Trace
          </a>
        </div>
        <!-- 生成的 TraceQL 预览 -->
        <p class="text-[10px] text-gray-500 font-mono break-all">
          <template v-if="traceIdFilter.trim()">
            Trace-ID: <span class="text-orange-400/80">{{ traceIdFilter.trim() }}</span>（精确查询，忽略其他条件）
          </template>
          <template v-else>
            TraceQL: <span class="text-orange-400/80">{{ buildTraceSearchQuery() }}</span>
          </template>
          <br />
          说明：trace-id 优先精确查询；否则模块名 → resource.service.name，接口名 → span name（正则匹配）；查询范围最近 1 小时
        </p>
      </div>
    </div>

    <!-- 批量日志查询 -->
    <div class="border-b border-gray-700 bg-gray-800/80">
      <div
        @click="logSearchExpanded = !logSearchExpanded"
        class="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <ScrollText class="w-4 h-4 text-cyan-400" />
          <span class="text-xs font-medium text-cyan-400">批量日志查询</span>
        </div>
        <component
          :is="logSearchExpanded ? ChevronDown : ChevronRight"
          class="w-4 h-4 text-gray-400"
        />
      </div>
      <div v-if="logSearchExpanded" class="px-4 pb-3">
        <!-- trace-id 筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">trace-id</span>
          <input
            v-model="logTraceIdFilter"
            type="text"
            placeholder="按 trace-id 筛选日志行内容"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-cyan-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            v-if="logTraceIdFilter"
            @click="logTraceIdFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 模块名筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">模块名</span>
          <input
            v-model="logModuleFilter"
            type="text"
            list="log-module-list"
            placeholder="如 pay_gate，留空查询所有模块"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <datalist id="log-module-list">
            <option v-for="mod in MODULES" :key="mod" :value="mod">{{ mod }}</option>
          </datalist>
          <button
            v-if="logModuleFilter"
            @click="logModuleFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 接口名筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">接口名</span>
          <input
            v-model="logEndpointFilter"
            type="text"
            placeholder="接口路径，支持正则，如 /api/user/login 或 .*login.*"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            v-if="logEndpointFilter"
            @click="logEndpointFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 错误码 + user_id 筛选 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">错误码</span>
          <input
            v-model="logErrorCodeFilter"
            type="text"
            placeholder="如 100001006"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            v-if="logErrorCodeFilter"
            @click="logErrorCodeFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[11px] text-gray-400 w-14 flex-shrink-0">user_id</span>
          <input
            v-model="logUserIdFilter"
            type="text"
            placeholder="用户 ID，如 12345"
            class="flex-1 min-w-0 px-2 py-1 rounded bg-gray-700/60 border border-gray-600/40 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            v-if="logUserIdFilter"
            @click="logUserIdFilter = ''"
            class="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            清除
          </button>
        </div>
        <!-- 查询按钮 -->
        <div class="flex items-center justify-end mb-2">
          <a
            :href="buildLogSearchUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-cyan-600/20 text-cyan-300 border border-cyan-600/40 hover:bg-cyan-600/40 transition-colors"
            :title="`LogQL: ${buildLogSearchQuery()}`"
          >
            <Search class="w-3.5 h-3.5" />
            查询日志
          </a>
        </div>
        <!-- 生成的 LogQL 预览 -->
        <p class="text-[10px] text-gray-500 font-mono break-all">
          LogQL: <span class="text-cyan-400/80">{{ buildLogSearchQuery() }}</span>
          <br />
          说明：模块名 → container 标签；trace-id/错误码/user_id → 行内容包含(\|=)；接口名 → 行内容正则匹配(\|~)；查询范围最近 1 小时
        </p>
      </div>
    </div>

    <div class="p-4 text-xs text-gray-400 border-b border-gray-700 bg-gray-800/50">
      <span>共 {{ debugStore.requestLogs.length }} 条请求</span>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div
        v-for="log in debugStore.requestLogs"
        :key="log.id"
        class="bg-gray-800 rounded-lg overflow-hidden"
      >
        <div
        @click="toggleExpand(log.id)"
        class="p-3 cursor-pointer hover:bg-gray-700 transition-colors"
      >
        <div class="flex items-center gap-3">
          <component
            :is="expandedLogs.has(log.id) ? ChevronDown : ChevronRight"
            class="w-4 h-4 text-gray-400 flex-shrink-0"
          />
          <span
            :class="['px-2 py-1 rounded text-xs font-medium', getMethodClass(log.method)]"
          >
            {{ log.method }}
          </span>
          <span class="flex-1 text-sm text-gray-300 truncate">{{ log.url }}</span>
          <a
            :href="buildLogQueryUrl(log.traceparent)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-cyan-400 font-mono flex-shrink-0 hover:text-cyan-300"
            :title="`trace-id: ${getTraceId(log.traceparent)}\n点击查看 Grafana 日志`"
            @click.stop
          >
            {{ getTraceId(log.traceparent).slice(0, 8) }}
          </a>
          <a
            :href="buildTempoTraceUrl(log.traceparent)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-orange-400 flex-shrink-0 hover:text-orange-300"
            :title="`trace-id: ${getTraceId(log.traceparent)}\n点击查看 Grafana Tempo 链路`"
            @click.stop
          >
            <Network class="w-3.5 h-3.5" />
          </a>
          <span :class="['text-sm font-medium', getStatusClass(log.statusCode)]">
            {{ log.statusCode || '-' }}
          </span>
          <div class="flex items-center gap-1 text-xs text-gray-400">
            <Clock class="w-3 h-3" />
            {{ formatDuration(log.duration) }}
          </div>
          <AlertCircle v-if="log.error || (log.responseData && log.responseData.code !== undefined && log.responseData.code !== 0)" class="w-4 h-4 text-red-500 flex-shrink-0" />
        </div>
        
        <div v-if="log.responseData && (log.responseData.code !== undefined || log.responseData.message !== undefined)" class="mt-2 flex items-center gap-3 pl-7">
          <span class="text-xs text-gray-500">code:</span>
          <span :class="['text-xs font-medium', log.responseData.code === 0 ? 'text-green-400' : 'text-red-400']">
            {{ log.responseData.code }}
          </span>
          <span class="text-xs text-gray-500">msg:</span>
          <span class="text-xs text-gray-300 truncate">{{ log.responseData.message || log.responseData.msg || '-' }}</span>
        </div>
      </div>

        <div
          v-if="expandedLogs.has(log.id)"
          class="border-t border-gray-700 p-3 space-y-4"
        >
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-blue-400">请求时间</span>
              <span class="text-xs text-gray-400">{{ formatDateTime(log.timestamp) }}</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-cyan-400">Traceparent</span>
              <div class="flex items-center gap-3">
                <a
                  :href="buildLogQueryUrl(log.traceparent)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                  title="在 Grafana Loki 中查看该请求的链路日志"
                >
                  <ExternalLink class="w-3 h-3" />
                  查看日志
                </a>
                <a
                  :href="buildTempoTraceUrl(log.traceparent)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
                  title="在 Grafana Tempo 中查看该请求的分布式链路追踪"
                >
                  <Network class="w-3 h-3" />
                  查看Trace
                </a>
                <button
                  @click.stop="copyJson(log.traceparent, log.id)"
                  class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                >
                  <component :is="copiedId === log.id ? Check : Copy" class="w-3 h-3" />
                  {{ copiedId === log.id ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
            <span class="text-xs font-mono text-cyan-300 break-all">{{ log.traceparent }}</span>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-green-400">请求参数</span>
              <button
                @click.stop="copyJson(log.requestBody, log.id)"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                <component :is="copiedId === log.id ? Check : Copy" class="w-3 h-3" />
                {{ copiedId === log.id ? '已复制' : '复制' }}
              </button>
            </div>
            <pre class="text-xs text-gray-300 bg-gray-900 p-3 rounded-lg max-h-40 overflow-auto"><code>{{ JSON.stringify(log.requestBody, null, 2) }}</code></pre>
          </div>

          <div v-if="log.responseData && (log.responseData.code !== undefined || log.responseData.message !== undefined)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-purple-400">响应状态</span>
            </div>
            <div class="bg-gray-900 rounded-lg p-3 space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-16">code:</span>
                <span :class="['text-xs font-medium', log.responseData.code === 0 ? 'text-green-400' : 'text-red-400']">
                  {{ log.responseData.code }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-16">message:</span>
                <span class="text-xs text-gray-300">{{ log.responseData.message || log.responseData.msg || '-' }}</span>
              </div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-yellow-400">返回数据</span>
              <button
                @click.stop="copyJson(log.responseData, log.id)"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                <component :is="copiedId === log.id ? Check : Copy" class="w-3 h-3" />
                {{ copiedId === log.id ? '已复制' : '复制' }}
              </button>
            </div>
            <pre class="text-xs text-gray-300 bg-gray-900 p-3 rounded-lg max-h-60 overflow-auto"><code>{{ JSON.stringify(log.responseData, null, 2) }}</code></pre>
          </div>

          <div v-if="log.error" class="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle class="w-4 h-4" />
            <span>错误: {{ log.error }}</span>
          </div>
        </div>
      </div>

      <div v-if="debugStore.requestLogs.length === 0" class="text-center py-8 text-gray-500">
        <Zap class="w-8 h-8 mx-auto mb-2" />
        <p class="text-sm">暂无请求记录</p>
        <p class="text-xs mt-1">执行操作后，请求日志会显示在这里</p>
      </div>
    </div>
  </div>
</template>