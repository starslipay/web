<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import { ArrowLeft, ArrowRightLeft, Building, Lock, Eye, EyeOff } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'c2c' | 'bank2c'>('c2c')
const loading = ref(false)
const showPassword = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const c2cForm = reactive({
  buyer_user_id: authStore.userId || '',
  seller_user_id: '',
  amount: '',
  verify_type: 1,
  password: '',
})

const bank2cForm = reactive({
  user_id: authStore.userId || '',
  bank_type: 1,
  amount: '',
  desc: '',
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

const resetC2C = () => {
  c2cForm.seller_user_id = ''
  c2cForm.amount = ''
  c2cForm.password = ''
}

const resetBank2C = () => {
  bank2cForm.bank_type = 1
  bank2cForm.amount = ''
  bank2cForm.desc = ''
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

const c2cTransfer = async () => {
  if (!c2cForm.seller_user_id || !c2cForm.amount || !c2cForm.password) {
    showToast('请填写完整的转账信息', 'error')
    return
  }

  loading.value = true
  try {
    const preResponse = await payGateApi.c2cTransferPre({ buyer_user_id: c2cForm.buyer_user_id })
    
    const amountInCents = Math.round(parseFloat(c2cForm.amount) * 100)
    
    const doResponse = await payGateApi.c2cTransferDo({
      transaction_id: preResponse.transaction_id,
      buyer_user_id: c2cForm.buyer_user_id,
      seller_user_id: c2cForm.seller_user_id,
      amount: amountInCents,
      verify_type: c2cForm.verify_type,
      password: c2cForm.password,
    })

    if (doResponse.is_repeat === 1) {
      showToast('该交易已重复提交', 'warning')
    } else {
      showToast('转账成功', 'success')
      await authStore.getUserBalance()
      resetC2C()
    }
  } catch (error) {
    showToast('转账失败，请检查密码和余额', 'error')
  } finally {
    loading.value = false
  }
}

const bank2cTransfer = async () => {
  if (!bank2cForm.amount || !bank2cForm.desc || !bank2cForm.password) {
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
      desc: bank2cForm.desc,
      verify_type: bank2cForm.verify_type,
      password: bank2cForm.password,
    })

    if (doResponse.is_repeat === 1) {
      showToast('该交易已重复提交', 'warning')
    } else {
      showToast('充值成功', 'success')
      await authStore.getUserBalance()
      resetBank2C()
    }
  } catch (error) {
    showToast('充值失败，请检查密码', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-2xl mx-auto">
      <header class="flex items-center gap-4 mb-6 animate-fade-in">
        <button
          @click="goBack"
          class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <h1 class="text-2xl font-bold text-white">转账管理</h1>
      </header>

      <div class="card p-6 animate-slide-up">
        <div class="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            @click="activeTab = 'c2c'; resetC2C()"
            :class="[
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all duration-200',
              activeTab === 'c2c'
                ? 'bg-white shadow-md text-primary-600'
                : 'text-gray-500 hover:text-gray-700',
            ]"
          >
            <ArrowRightLeft class="w-5 h-5" />
            C2C转账
          </button>
          <button
            @click="activeTab = 'bank2c'; resetBank2C()"
            :class="[
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all duration-200',
              activeTab === 'bank2c'
                ? 'bg-white shadow-md text-primary-600'
                : 'text-gray-500 hover:text-gray-700',
            ]"
          >
            <Building class="w-5 h-5" />
            银行卡充值
          </button>
        </div>

        <div v-if="activeTab === 'c2c'" class="space-y-4">
          <div>
            <label class="label">买方用户ID</label>
            <input
              v-model="c2cForm.buyer_user_id"
              type="text"
              class="input-field"
              placeholder="请输入买方用户ID"
              readonly
            />
          </div>

          <div>
            <label class="label">卖方用户ID</label>
            <input
              v-model="c2cForm.seller_user_id"
              type="text"
              class="input-field"
              placeholder="请输入卖方用户ID"
            />
          </div>

          <div>
            <label class="label">转账金额</label>
            <input
              v-model="c2cForm.amount"
              type="text"
              class="input-field"
              placeholder="请输入转账金额（元）"
              @input="c2cForm.amount = formatAmount(c2cForm.amount)"
            />
          </div>

          <div>
            <label class="label">交易密码</label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="c2cForm.password"
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
            @click="c2cTransfer"
            :disabled="loading"
            class="w-full btn-success py-3 text-lg"
          >
            {{ loading ? '处理中...' : '确认转账' }}
          </button>
        </div>

        <div v-else class="space-y-4">
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
            <label class="label">备注</label>
            <textarea
              v-model="bank2cForm.desc"
              class="input-field resize-none"
              rows="3"
              placeholder="请输入备注信息"
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
  transform: translateX(100%);
}
</style>