<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Undo2, Loader2, CheckCircle2, Zap } from 'lucide-vue-next'
import { payGateApi } from '@/api/pay_gate'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const debugStore = useDebugStore()

const transactionId = ref('')
const loading = ref(false)
const result = ref<{ success: boolean; message: string } | null>(null)

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  toast.show = true
  toast.message = message
  toast.type = type
  setTimeout(() => { toast.show = false }, 3000)
}

const handleRefund = async () => {
  const tid = transactionId.value.trim()
  if (!tid) {
    showToast('请输入交易单号', 'warning')
    return
  }
  loading.value = true
  result.value = null
  try {
    const rsp = await payGateApi.refundOrder({ transaction_id: tid })
    result.value = {
      success: true,
      message: `退款成功, 交易单号: ${rsp.transaction_id}`,
    }
    showToast('退款成功', 'success')
  } catch (error) {
    result.value = {
      success: false,
      message: (error as Error).message,
    }
    showToast('退款失败: ' + (error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}

const goBack = () => router.back()
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-2xl mx-auto">
      <!-- 页头 -->
      <header class="flex items-center justify-between mb-6 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow transition-all"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <Undo2 class="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">触发退款</h1>
              <p class="text-sm text-gray-500">按交易单号发起订单退款</p>
            </div>
          </div>
        </div>
        <!-- 调试模式开关 -->
        <button
          @click="debugStore.toggleDebugMode()"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            debugStore.isDebugMode ? 'bg-yellow-400 text-yellow-900 shadow-lg' : 'bg-white text-gray-600 hover:text-gray-900 hover:shadow',
          ]"
        >
          <Zap class="w-4 h-4" />
          {{ debugStore.isDebugMode ? '调试中' : '调试模式' }}
        </button>
      </header>

      <!-- 退款卡片 -->
      <div class="card p-6 animate-slide-up">
        <div class="flex items-center gap-2 mb-4">
          <Undo2 class="w-5 h-5 text-orange-500" />
          <h3 class="font-semibold text-gray-800">订单退款</h3>
        </div>
        <p class="text-sm text-gray-500 mb-4">按交易单号发起退款, 退款成功后资金原路退回买家账户</p>
        <div class="flex gap-3">
          <input
            v-model="transactionId"
            type="text"
            placeholder="请输入交易单号"
            class="input-field font-mono flex-1"
            @keyup.enter="handleRefund"
          />
          <button
            @click="handleRefund"
            :disabled="loading || !transactionId.trim()"
            class="btn-primary flex items-center gap-2"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <Undo2 v-else class="w-4 h-4" />
            {{ loading ? '退款中...' : '发起退款' }}
          </button>
        </div>
        <!-- 退款结果 -->
        <div v-if="result" class="mt-4">
          <div
            :class="[
              'flex items-center gap-2 p-3 rounded-lg text-sm',
              result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
            ]"
          >
            <CheckCircle2 v-if="result.success" class="w-4 h-4 flex-shrink-0" />
            <span v-else class="w-4 h-4 flex-shrink-0 text-center font-bold">✕</span>
            <span class="break-all">{{ result.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast.show"
        :class="[
          'fixed top-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50',
          toast.type === 'success' ? 'bg-green-500 text-white' : '',
          toast.type === 'error' ? 'bg-red-500 text-white' : '',
          toast.type === 'warning' ? 'bg-yellow-500 text-white' : '',
        ]"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateY(-10px); }
.toast-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
