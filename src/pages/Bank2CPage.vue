<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import { ArrowLeft, Building, Lock, Eye, EyeOff, Zap } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const showPassword = ref(false)
let refreshInterval: ReturnType<typeof setInterval> | null = null
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const bank2cForm = reactive({
  user_id: authStore.userId || '',
  bank_type: 1,
  amount: '',
  memo: '',
  verify_type: 1,
  password: '',
})

const bankTypes = [
  { value: 1, label: '工商银行' },
  { value: 2, label: '建设银行' },
  { value: 3, label: '农业银行' },
  { value: 4, label: '中国银行' },
  { value: 5, label: '交通银行' },
  { value: 6, label: '招商银行' },
  { value: 7, label: '浦发银行' },
  { value: 8, label: '民生银行' },
]

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

const resetForm = () => {
  bank2cForm.bank_type = 1
  bank2cForm.amount = ''
  bank2cForm.memo = ''
  bank2cForm.password = ''
}

const formatAmount = (value: string) => {
  if (!value) return ''
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return ''
  if (parts[1] && parts[1].length > 2) {
    parts[1] = parts[1].slice(0, 2)
  }
  return parts.join('.')
}

const bank2cTransfer = async () => {
  if (!bank2cForm.amount || !bank2cForm.password) {
    showToast('请填写完整的充值信息', 'error')
    return
  }

  loading.value = true

  try {
    const preResponse = await payGateApi.bank2cPre({ user_id: bank2cForm.user_id })

    const amountInCents = Math.round(parseFloat(bank2cForm.amount) * 100)

    const doResponse = await payGateApi.bank2cDo({
      transaction_id: preResponse.transaction_id,
      user_id: bank2cForm.user_id,
      bank_type: bank2cForm.bank_type,
      amount: amountInCents,
      memo: bank2cForm.memo || '默认',
      verify_type: bank2cForm.verify_type,
      password: bank2cForm.password,
    })

    if (doResponse.is_repeat === 1) {
      showToast('交易已重复提交', 'error')
    } else {
      showToast('充值成功', 'success')
    }

    await authStore.getUserBalance()
    resetForm()
  } catch (error) {
    const msg = (error as Error).message || '充值失败'
    showToast(msg, 'error')
  } finally {
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
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">银行卡充值</h1>
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
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <Building class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="font-semibold text-gray-800">Bank2C充值</h2>
            <p class="text-sm text-gray-500">银行卡充值到账户</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">用户ID</label>
            <input
              v-model="bank2cForm.user_id"
              type="text"
              class="input-field"
              placeholder="请输入用户ID"
              readonly
            />
          </div>

          <div>
            <label class="label">银行类型</label>
            <select v-model="bank2cForm.bank_type" class="input-field">
              <option v-for="bank in bankTypes" :key="bank.value" :value="bank.value">
                {{ bank.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">充值金额</label>
            <input
              v-model="bank2cForm.amount"
              type="text"
              class="input-field"
              placeholder="请输入充值金额（元）"
              @input="bank2cForm.amount = formatAmount(bank2cForm.amount)"
            />
          </div>

          <div>
            <label class="label">备注（选填）</label>
            <textarea
              v-model="bank2cForm.memo"
              class="input-field resize-none"
              rows="3"
              placeholder="不填则默认为'默认'"
            ></textarea>
          </div>

          <div>
            <label class="label">交易密码</label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="bank2cForm.password"
                :type="showPassword ? 'text' : 'password'"
                class="input-field pl-12 pr-12"
                placeholder="请输入交易密码"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <EyeOff v-if="showPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            @click="bank2cTransfer"
            :disabled="loading"
            class="w-full btn-success py-3 text-lg"
          >
            {{ loading ? '处理中...' : '确认充值' }}
          </button>
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
