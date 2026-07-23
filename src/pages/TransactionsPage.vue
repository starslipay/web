<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import type { UserFlow } from '@/api/types'
import { ArrowLeft, Clock, Users, ArrowDownLeft, ArrowUpRight, RefreshCw, FileText, Zap } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const refreshing = ref(false)
const transactionList = ref<UserFlow[]>([])
const currentOffset = ref(0)
const pageSize = ref(20)
const hasMore = ref(true)
const totalCount = ref(0)

const toast = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.value.message = message
  toast.value.type = type
  toast.value.show = true
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const pageSizes = [10, 20, 50, 100]

const getInoutTypeText = (type: number) => {
  const texts: Record<number, string> = {
    0: '未知',
    1: '收入',
    2: '支出',
  }
  return texts[type] || '未知'
}

const getInoutTypeClass = (type: number) => {
  if (type === 1) return 'text-green-600 bg-green-50'
  if (type === 2) return 'text-red-600 bg-red-50'
  return 'text-gray-600 bg-gray-50'
}

const getInoutIcon = (type: number) => {
  if (type === 1) return ArrowDownLeft
  if (type === 2) return ArrowUpRight
  return FileText
}

const getBizTypeText = (type: number) => {
  const texts: Record<number, string> = {
    0: '未知',
    1: 'Bank2C充值',
    2: 'C2C转账',
  }
  return texts[type] || '未知'
}

const formatAmount = (amount: number) => {
  const yuan = amount / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const formatBalance = (balance: number) => {
  const yuan = balance / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const loadTransactions = async (reset = false) => {
  if (reset) {
    currentOffset.value = 0
    transactionList.value = []
    hasMore.value = true
  }

  if (!hasMore.value || loading.value) return

  loading.value = true
  try {
    const response = await payGateApi.getUserFlow({
      user_id: authStore.userId,
      offset: currentOffset.value,
      limit: pageSize.value,
    })

    if (response.UserFlowList && response.UserFlowList.length > 0) {
      transactionList.value = [...transactionList.value, ...response.UserFlowList]
      currentOffset.value = response.next_offset
      hasMore.value = response.end_flag !== 1
      totalCount.value = transactionList.value.length
    } else {
      hasMore.value = false
    }
  } catch (error) {
    const msg = (error as Error).message || '获取交易明细失败'
    showToast(msg, 'error')
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  refreshing.value = true
  await loadTransactions(true)
  refreshing.value = false
}

const changePageSize = () => {
  loadTransactions(true)
}

const goBack = () => {
  router.push('/dashboard')
}

onMounted(() => {
  loadTransactions()
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-4xl mx-auto">
      <header class="flex items-center justify-between mb-6 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">交易明细</h1>
        </div>
        
        <div class="flex items-center gap-3">
          <button
            @click="debugStore.toggleDebugMode"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
              debugStore.isDebugMode
                ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-400/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            ]"
          >
            <Zap class="w-4 h-4" />
            {{ debugStore.isDebugMode ? '调试中' : '调试模式' }}
          </button>
          <button
            @click="refreshData"
            :disabled="refreshing"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <RefreshCw :class="['w-4 h-4', refreshing ? 'animate-spin' : '']" />
            刷新
          </button>
        </div>
      </header>

      <div class="card p-4 mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">共 {{ totalCount }} 条记录</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">每页显示</span>
          <select
            v-model="pageSize"
            @change="changePageSize"
            class="input-field text-sm"
            style="width: auto; min-width: 80px;"
          >
            <option v-for="size in pageSizes" :key="size" :value="size">
              {{ size }} 条
            </option>
          </select>
        </div>
      </div>

      <div v-if="loading && transactionList.length === 0" class="card p-8 text-center">
        <RefreshCw class="w-8 h-8 text-primary-600 animate-spin mx-auto" />
        <p class="text-gray-500 mt-4">加载中...</p>
      </div>

      <div v-else-if="transactionList.length === 0" class="card p-8 text-center">
        <FileText class="w-12 h-12 text-gray-300 mx-auto" />
        <p class="text-gray-500 mt-4">暂无交易记录</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(transaction, index) in transactionList"
          :key="transaction.transaction_id"
          class="card p-4 hover:shadow-md transition-shadow animate-slide-up"
          :style="{ animationDelay: `${index * 0.02}s` }"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <div
                :class="[
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  getInoutTypeClass(transaction.inout_type),
                ]"
              >
                <component :is="getInoutIcon(transaction.inout_type)" class="w-6 h-6" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-800">{{ getBizTypeText(transaction.biz_type) }}</span>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full',
                      getInoutTypeClass(transaction.inout_type),
                    ]"
                  >
                    {{ getInoutTypeText(transaction.inout_type) }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 mt-1">{{ transaction.desc || '无备注' }}</p>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <div class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ formatDateTime(transaction.create_time) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <Users class="w-3 h-3" />
                    对手方: {{ transaction.counterparty_user_id || '-' }}
                  </div>
                </div>
              </div>
            </div>
            <div class="text-right">
              <div
                :class="[
                  'text-lg font-semibold',
                  transaction.inout_type === 1 ? 'text-green-600' : 'text-red-600',
                ]"
              >
                {{ transaction.inout_type === 1 ? '+' : '-' }}¥{{ formatAmount(transaction.amount) }}
              </div>
              <p class="text-xs text-gray-400 mt-1">余额: ¥{{ formatBalance(transaction.balance) }}</p>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="card p-4 text-center">
          <button
            @click="loadTransactions()"
            :disabled="loading"
            class="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>

        <div v-else-if="transactionList.length > 0" class="card p-4 text-center">
          <p class="text-sm text-gray-400">已加载全部交易记录</p>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div
        v-if="toast.show"
        :class="[
          'toast',
          toast.type === 'success' ? 'toast-success' : '',
          toast.type === 'error' ? 'toast-error' : '',
          toast.type === 'warning' ? 'toast-warning' : '',
        ]"
      >
        <span class="font-medium">{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}
</style>