---
name: grafana-explore-links
description: Build correctly encoded Grafana Explore deep links (Loki logs, Tempo traces, Prometheus metrics). Use when adding debug-panel jump links like trace-id lookups or module QPS metrics. Not for Grafana iframes or alerts.
---

# Grafana Explore 跳转链接生成

为本项目生成可直接点击的 Grafana Explore 深链接。参考实现：`src/components/DebugPanel.vue`（已含 Loki / Tempo / Prometheus 三类链接的完整代码）。

## 固定配置

- Base URL：`http://43.136.84.124:31000/explore`
- URL 骨架：`${base}?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}&orgId=1`
- 数据源 UID：
  - Loki 日志：`afwwzpsybzsw0a`（type: `loki`）
  - Tempo 链路：`tempo`（type: `tempo`）
  - Prometheus 指标：`prometheus`（type: `prometheus`）
- 业务模块：`pay_gate`、`trade_itg`、`user_mgr`、`account_mgr`、`order_mgr`、`trade_ig_mgr`
- Loki 容器正则：`pay_gate|trade_itg|user_mgr|account_mgr|order_mgr|trade_ig_mgr`

## 最关键的编码规则（曾踩坑）

1. 把**原始** expr/query 字符串直接放进 panes 对象，引号由 `JSON.stringify` 自动转义为 `\"`。
2. 只对**整个 JSON 做一次** `encodeURIComponent`。
3. **绝不**先对 expr 单独 `encodeURIComponent` —— 双重编码会导致 Grafana 打开后查询语句是乱码/解析失败。
4. 时间范围支持相对字符串：`now-30m`、`now-1h`、`now`（Explore 链接中直接写字面量即可，不要用毫秒时间戳，除非用户给的参考 URL 用的就是毫秒）。

## trace-id 来源

请求头使用 W3C Trace Context：`traceparent: 00-<32hex trace-id>-<16hex parent-id>-01`（在 `src/utils/axios.ts` 的请求拦截器生成）。提取 trace-id：取 `-` 分割后的第 2 段。

## 三类链接的 pane 模板

### Loki 日志（单 pane，key 如 `hzj`）

查询表达式：`{container=~"<容器正则>"} |= "<trace-id>"`

```js
{
  hzj: {
    datasource: 'afwwzpsybzsw0a',
    queries: [{
      refId: 'A',
      expr: rawExpr,                 // 原始 LogQL，不预编码
      queryType: 'range',
      datasource: { type: 'loki', uid: 'afwwzpsybzsw0a' },
      editorMode: 'code',
    }],
    range: { from: 'now-30m', to: 'now' },
  },
}
```

### Tempo 链路（两个 pane，TraceQL + 纯 trace-id 直查）

- pane `hzj`：`query` 为 TraceQL：`{ .service.name = "pay_gate" && trace:id = "<trace-id>" }`，需带 `filters: [{ id: 'd84686bf', operator: '=', scope: 'span' }]`
- pane `b9r`：`query` 直接填裸 trace-id
- 两者都带 `queryType: 'traceql'`、`limit: 20`、`tableType: 'traces'`，range 用 `now-1h`

### Prometheus 指标（单 pane，key 如 `f82`）

每个 query 必须带的固定字段：`range: true`、`editorMode: 'builder'`、`legendFormat: '{{module}}'`（聚合后按模块名显示图例）、`useBackend/disableTextWrap/fullMetaSearch/includeNullMetadata: false`。多个查询时 refId 依次为 `A`、`B`（「全部模块」就是两条查询叠加在一个 pane）。

指标口径约定：

- `pay_gate` 是 HTTP 网关 → 计数指标 `http_server_requests_code_total`，耗时指标 `http_server_requests_duration_milliseconds`（Histogram，标签 `path`，buckets: 5,10,25,50,100,250,500,1000 ms）
- 其余 5 个是 RPC 服务 → 计数指标 `rpc_server_requests_code_total`，耗时指标 `rpc_server_requests_duration_milliseconds`（Histogram，标签 `method`）
- counter 自带 code/path/method 等标签，不聚合会有多条曲线，必须按维度聚合：`sum by (module) (...)` 或 `sum by (path) (...)` 等
- 四个指标维度：
  1. **请求数**（Counter）：`round(sum by(labels)(increase(selector[1m])))` 或 `sum by(labels)(rate(selector[1m]))`
  2. **错误码**（自定义 `pay_biz_code_total`，标签 `service/method/code/result`）：按 `code` 拆分，`code!="0"` 过滤出业务错误（如 100001006=token失效）。注意标签是 `service` 不是 `module`
  3. **平均耗时**（Histogram `_sum`/`_count`）：`sum by(labels)(rate(metric_sum[1m])) / sum by(labels)(rate(metric_count[1m]))`，单位 ms
  4. **最高耗时**（Histogram `_bucket`）：`histogram_quantile(0.99, sum by(labels, le)(rate(metric_bucket[1m])))`，P99 分位，单位 ms
- 接口筛选（用户可输入正则）：
  - 无筛选：单模块按 `path`/`method` 聚合，显示每个接口一条线；全部模块按 `module` 聚合
  - 有筛选：单模块用 `path=~"..."/method=~"..."` 过滤后按 `code` 聚合（看该接口成功/失败）；全部模块按 `module` 聚合（看哪些模块命中）
  - `legendFormat` 跟随聚合维度：`{{path}}` / `{{method}}` / `{{code}}` / `{{module}}`
- 全部模块：A = pay_gate HTTP 指标，B = RPC 指标，两条都包同样的聚合函数

## 实现要求

- 新链接统一加在 `src/components/DebugPanel.vue`：常量集中在 `<script setup>` 顶部，链接函数返回完整 URL 字符串；模板中用 `<a target="_blank" rel="noopener noreferrer" @click.stop>`。
- 用户给新参考 URL 时，先把 `panes=` 参数 `decodeURIComponent` 还原成 JSON 比对结构，再改代码，不要凭猜测拼字段。
- 改完必须 `npm.cmd run build`（PowerShell，cwd 为项目根）验证；可用临时 node 脚本打印生成 URL 并回读 `JSON.parse(decodeURIComponent(...))` 确认 expr/query 是可读原文，验证后删除临时脚本。
- 可复用的 TS 辅助函数模板见 `assets/grafana-explore-urls.ts`，需要时拷贝到项目中使用。
