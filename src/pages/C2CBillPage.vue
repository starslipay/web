<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDebugStore } from '@/stores/debug'
import { payGateApi } from '@/api/pay_gate'
import type { GetC2CBillRsp } from '@/api/types'
import { ArrowLeft, Search, Clock, Users, FileText, Zap, Wallet } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const searching = ref(false)
const billInfo = ref<GetC2CBillRsp | null>(null)
const notFound = ref(false)
let refreshInterval: ReturnType<typeof setInterval> | null = null

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

const queryBill = async () => {
  if (!form.transaction_id.trim()) {
    showToast('请输入交易单号', 'error')
    return
  }

  searching.value = true
  loading.value = true
  notFound.value = false
  billInfo.value = null

  try {
    const response = await payGateApi.getC2CBill({
      transaction_id: form.transaction_id.trim(),
    })
    billInfo.value = response
  } catch (error) {
    const msg = (error as Error).message || '查询失败'
    if (msg.includes('not found') || msg.includes('不存在')) {
      notFound.value = true
    } else {
      showToast(msg, 'error')
    }
  } finally {
    searching.value = false
    loading.value = false
  }
}

onMounted(() => {
  refreshInterval = setInterval(async () => {
    try {
      await authStore.getUserBalance()
    } catch (error) {
      console.error('定时刷新余额失败:', error)
    }
  }, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-2xl mx-auto">
      <header class="flex items-center justify-between mb-6 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">查询C2C单据</h1>
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
          <h2 class="text-lg font-semibold text-gray-800">输入交易单号查询</h2>
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
                placeholder="请输入C2C转账交易单号"
                autocomplete="off"
              />
            </div>
          </div>

          <button
            @click="queryBill"
            :disabled="searching"
            class="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            <Search class="w-5 h-5" />
            {{ searching ? '查询中...' : '查询单据' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="card p-8 text-center mt-6">
        <div class="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-gray-500 mt-4">查询中...</p>
      </div>

      <div v-else-if="notFound" class="card p-8 text-center mt-6">
        <FileText class="w-12 h-12 text-gray-300 mx-auto" />
        <p class="text-gray-500 mt-4">未找到该交易单号</p>
        <p class="text-sm text-gray-400 mt-1">请检查单号是否正确</p>
      </div>

      <div v-else-if="billInfo" class="card p-6 mt-6 animate-slide-up">
        <div class="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
          <Wallet class="w-5 h-5 text-primary-600" />
          <h2 class="text-lg font-semibold text-gray-800">单据详情</h2>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">交易单号</span>
            </div>
            <span class="font-medium text-gray-800 font-mono">{{ billInfo.transaction_id }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Users class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">买方用户ID</span>
            </div>
            <span class="font-medium text-gray-800">{{ billInfo.buyer_user_id }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Users class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">卖方用户ID</span>
            </div>
            <span class="font-medium text-gray-800">{{ billInfo.seller_user_id }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Clock class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">交易时间</span>
            </div>
            <span class="font-medium text-gray-800">{{ formatDateTime(billInfo.pay_time) }}</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center gap-2">
              <Wallet class="w-4 h-4 text-blue-400" />
              <span class="text-sm text-blue-600">交易金额</span>
            </div>
            <span class="text-xl font-bold text-blue-600">¥{{ formatAmount(billInfo.amount) }}</span>
          </div>

          <div v-if="billInfo.desc" class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-500">备注</span>
            </div>
            <p class="text-gray-800">{{ billInfo.desc }}</p>
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
