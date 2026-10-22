<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDebugStore } from '@/stores/debug'
import { payGateApi } from '@/api/pay_gate'
import type { QueryOrderRsp, QueryC2BBillRsp } from '@/api/types'
import { ArrowLeft, Search, Clock, Users, FileText, Zap, Wallet, Building, User as UserIcon, CheckCircle, Hash, Calendar, Store, ShoppingCart, ReceiptText, XCircle } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const searching = ref(false)
const orderInfo = ref<QueryOrderRsp | null>(null)
const notFound = ref(false)
// 顺带查询的C2B单据(用于与订单数据对比)
const c2bInfo = ref<QueryC2BBillRsp | null>(null)
const c2bNotFound = ref(false)

const form = reactive({
  transaction_id: '',
})

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const goBack = () => {
  router.push('/dashboard')
}

const formatAmount = (amount: number) => {
  const yuan = amount / 100
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

const tradeStateMap: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '待支付', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  2: { label: '支付成功', color: 'text-green-700', bg: 'bg-green-100' },
  99: { label: '已关闭', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const getTradeStateInfo = (state: number) => {
  return tradeStateMap[state] || { label: `状态${state}`, color: 'text-gray-700', bg: 'bg-gray-100' }
}

const queryOrder = async () => {
  if (!form.transaction_id.trim()) {
    showToast('请输入交易单号', 'error')
    return
  }

  searching.value = true
  loading.value = true
  notFound.value = false
  orderInfo.value = null
  c2bInfo.value = null
  c2bNotFound.value = false

  try {
    // 并行查询订单和C2B单据；C2B查询失败不影响订单展示，仅标记未找到
    const [orderResult, c2bResult] = await Promise.allSettled([
      payGateApi.queryOrder({
        transaction_id: form.transaction_id.trim(),
      }),
      payGateApi.queryC2BBill({
        transaction_id: form.transaction_id.trim(),
      }),
    ])

    if (orderResult.status === 'fulfilled') {
      orderInfo.value = orderResult.value
    } else {
      const msg = orderResult.reason?.message || '查询失败'
      if (msg.includes('not found') || msg.includes('不存在')) {
        notFound.value = true
      } else {
        showToast(msg, 'error')
      }
    }

    if (c2bResult.status === 'fulfilled') {
      c2bInfo.value = c2bResult.value
    } else {
      c2bNotFound.value = true
    }
  } finally {
    searching.value = false
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-2xl mx-auto">
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">查询订单</h1>
        </div>

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
      </header>

      <div class="card p-6 animate-slide-up">
        <div class="flex items-center gap-2 mb-6">
          <Search class="w-5 h-5 text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-800">输入交易单号查询订单</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">交易单号</label>
            <div class="relative">
              <FileText class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="form.transaction_id"
                type="text"
                class="input-field pl-12"
                placeholder="请输入支付订单交易单号"
                autocomplete="off"
              />
            </div>
          </div>

          <button
            @click="queryOrder"
            :disabled="searching"
            class="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            <Search class="w-5 h-5" />
            {{ searching ? '查询中...' : '查询订单' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="card p-8 text-center mt-6">
        <div class="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-gray-500 mt-4">查询中...</p>
      </div>

      <div v-else-if="notFound" class="card p-8 text-center mt-6">
        <FileText class="w-12 h-12 text-gray-300 mx-auto" />
        <p class="text-gray-500 mt-4">未找到该订单</p>
        <p class="text-sm text-gray-400 mt-1">请检查交易单号是否正确</p>
      </div>

      <div v-else-if="orderInfo" class="card p-6 mt-6 animate-slide-up">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <ShoppingCart class="w-5 h-5 text-primary-600" />
            <h2 class="text-lg font-semibold text-gray-800">订单详情</h2>
          </div>
          <span
            :class="[
              'inline-flex items-center px-2.5 py-1 rounded text-xs font-medium',
              getTradeStateInfo(orderInfo.trade_state).bg,
              getTradeStateInfo(orderInfo.trade_state).color,
            ]"
          >
            <CheckCircle v-if="orderInfo.trade_state === 2" class="w-3 h-3 mr-1" />
            <Clock v-else-if="orderInfo.trade_state === 1" class="w-3 h-3 mr-1" />
            {{ getTradeStateInfo(orderInfo.trade_state).label }}({{ orderInfo.trade_state }})
          </span>
        </div>

        <div class="space-y-4">
          <!-- 买家信息 -->
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-3">
              <UserIcon class="w-4 h-4 text-gray-400" />
              <span class="text-sm font-medium text-gray-500">买家信息</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Users class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">用户ID</span>
              </div>
              <span class="font-medium text-gray-800">{{ orderInfo.user_id || '-' }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <Hash class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">用户UID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ orderInfo.uid || '-' }}<span class="text-amber-500">（生产环境不展示）</span></span>
            </div>
          </div>

          <!-- 卖家信息 -->
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-3">
              <Store class="w-4 h-4 text-gray-400" />
              <span class="text-sm font-medium text-gray-500">卖家信息</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Building class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">商户名称</span>
              </div>
              <span class="font-medium text-gray-800">{{ orderInfo.merchant_name || '-' }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <Store class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">商户ID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ orderInfo.merchant_id || '-' }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <Hash class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">商户UID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ orderInfo.merchant_uid || '-' }}<span class="text-amber-500">（生产环境不展示）</span></span>
            </div>
          </div>

          <!-- 金额信息 -->
          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Wallet class="w-4 h-4 text-blue-400" />
              <span class="text-sm text-blue-600">订单金额</span>
            </div>
            <span class="text-xl font-bold text-blue-600">¥{{ formatAmount(orderInfo.amount) }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">交易单号</span>
            </div>
            <span class="font-medium text-gray-800 font-mono text-xs break-all">{{ orderInfo.transaction_id }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">商户订单号</span>
            </div>
            <span class="font-medium text-gray-800 font-mono text-xs break-all">{{ orderInfo.out_order_no || '-' }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Calendar class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">支付时间</span>
            </div>
            <span class="font-medium text-gray-800">{{ orderInfo.pay_time ? formatDateTime(orderInfo.pay_time) : '-' }}</span>
          </div>

          <div v-if="orderInfo.order_success_token" class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <CheckCircle class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">成功凭证</span>
            </div>
            <span class="font-medium text-gray-800 font-mono text-xs break-all max-w-[200px]">{{ orderInfo.order_success_token }}<span class="text-amber-500">（生产环境不展示）</span></span>
          </div>
        </div>
      </div>

      <!-- C2B单据详情(与订单对比) -->
      <div v-if="orderInfo && c2bInfo" class="card p-6 mt-6 animate-slide-up">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <ReceiptText class="w-5 h-5 text-teal-600" />
            <h2 class="text-lg font-semibold text-gray-800">C2B单据详情</h2>
            <span class="text-xs text-gray-400">（同单号顺带查询，用于对比）</span>
          </div>
          <span
            :class="[
              'inline-flex items-center px-2.5 py-1 rounded text-xs font-medium',
              getTradeStateInfo(c2bInfo.state).bg,
              getTradeStateInfo(c2bInfo.state).color,
            ]"
          >
            <CheckCircle v-if="c2bInfo.state === 2" class="w-3 h-3 mr-1" />
            <Clock v-else-if="c2bInfo.state === 1" class="w-3 h-3 mr-1" />
            {{ getTradeStateInfo(c2bInfo.state).label }}({{ c2bInfo.state }})
          </span>
        </div>

        <div class="space-y-4">
          <!-- 买家信息 -->
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-3">
              <UserIcon class="w-4 h-4 text-gray-400" />
              <span class="text-sm font-medium text-gray-500">买家信息</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Users class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">用户ID</span>
              </div>
              <span class="font-medium text-gray-800">{{ c2bInfo.user_id || '-' }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <Hash class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">用户UID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ c2bInfo.uid || '-' }}<span class="text-amber-500">（生产环境不展示）</span></span>
            </div>
          </div>

          <!-- 卖家信息 -->
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-3">
              <Store class="w-4 h-4 text-gray-400" />
              <span class="text-sm font-medium text-gray-500">卖家信息</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Building class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">商户ID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ c2bInfo.merchant_id || '-' }}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <Hash class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-500">商户UID</span>
              </div>
              <span class="font-medium text-gray-800 font-mono">{{ c2bInfo.merchant_uid || '-' }}<span class="text-amber-500">（生产环境不展示）</span></span>
            </div>
          </div>

          <!-- 金额信息 -->
          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Wallet class="w-4 h-4 text-blue-400" />
              <span class="text-sm text-blue-600">单据金额</span>
            </div>
            <span class="text-xl font-bold text-blue-600">¥{{ formatAmount(c2bInfo.amount) }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">商户单号</span>
            </div>
            <span class="font-medium text-gray-800 font-mono text-xs break-all">{{ c2bInfo.out_trade_no || '-' }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Calendar class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">支付时间</span>
            </div>
            <span class="font-medium text-gray-800">{{ c2bInfo.pay_time ? formatDateTime(c2bInfo.pay_time) : '-' }}</span>
          </div>

          <div v-if="c2bInfo.deduct_token" class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <CheckCircle class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">扣款凭证</span>
            </div>
            <span class="font-medium text-gray-800 font-mono text-xs break-all max-w-[200px]">{{ c2bInfo.deduct_token }}<span class="text-amber-500">（生产环境不展示）</span></span>
          </div>
        </div>
      </div>

      <!-- C2B单据未找到提示(不影响订单展示) -->
      <div v-else-if="orderInfo && c2bNotFound && !loading" class="card p-6 mt-6 animate-slide-up">
        <div class="flex items-center gap-3 text-gray-400">
          <XCircle class="w-5 h-5" />
          <div>
            <p class="text-sm font-medium text-gray-500">未找到对应的C2B单据</p>
            <p class="text-xs text-gray-400 mt-0.5">该交易单号可能不存在C2B单据，或单据尚未生成</p>
          </div>
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
        {{ toast.message }}
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
