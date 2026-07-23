<script setup lang="ts">
import { useDebugStore } from '@/stores/debug'
import { X, Trash2, Copy, Check, ChevronDown, ChevronRight, Clock, Zap, AlertCircle } from 'lucide-vue-next'
import { ref } from 'vue'

const debugStore = useDebugStore()

const expandedLogs = ref<Set<number>>(new Set())
const copiedId = ref<number | null>(null)

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
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
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
</script>

<template>
  <div
    v-if="debugStore.isDebugMode"
    class="fixed top-0 right-0 h-full w-[600px] bg-gray-900 text-white shadow-2xl z-50 overflow-hidden flex flex-col animate-slide-in-right"
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