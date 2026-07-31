<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import type { GetOrderInfoRsp } from '@/api/types'
import { ArrowLeft, Lock, Eye, EyeOff, ShoppingCart, CreditCard, CheckCircle, AlertTriangle, Loader2, Zap } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const showPassword = ref(false)
const step = ref<'confirm' | 'processing' | 'success' | 'failed'>('confirm')
const errorMsg = ref('')
const password = ref('')
const outOrderNo = ref('')

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

interface LocalOrder {
  transaction_id: string
  out_order_no: string
  user_id: string
  merchant_id: string
  merchant_name: string
  product_id: string
  product_name: string
  product_desc: string
  amount: number
  pay_time: string
  trade_state: number
  order_success_token: string
}

const productInfo = computed(() => ({
  id: (route.query.productId as string) || '',
  name: (route.query.productName as string) || '虚拟商品',
  price: parseInt((route.query.productPrice as string) || '0'),
  desc: (route.query.productDesc as string) || '',
}))

const MERCHANT_ID = '2000000000'
const MERCHANT_NAME = 'starsli虚拟商城'

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const formatPrice = (price: number) => {
  const yuan = price / 100
  return yuan.toFixed(2)
}

const formatBalance = (balance: number) => {
  const yuan = balance / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

// 生成32位随机数字订单号
const generateOutOrderNo = (): string => {
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += Math.floor(Math.random() * 10).toString()
  }
  return result
}

const goBack = () => {
  if (loading.value) return
  router.push('/mall')
}

const goToMall = () => {
  router.push('/mall')
}

const goToOrders = () => {
  router.push('/orders')
}

const saveOrderToLocal = (order: LocalOrder) => {
  const key = `mall_orders_${authStore.userId}`
  try {
    const stored = localStorage.getItem(key)
    const orders: LocalOrder[] = stored ? JSON.parse(stored) : []
    orders.unshift(order)
    localStorage.setItem(key, JSON.stringify(orders))
  } catch (e) {
    console.error('保存订单失败:', e)
  }
}

const doPay = async () => {
  if (!password.value) {
    showToast('请输入支付密码', 'error')
    return
  }

  loading.value = true
  step.value = 'processing'
  errorMsg.value = ''

  try {
    outOrderNo.value = generateOutOrderNo()

    // 1. 调用支付下单接口
    const preResp = await payGateApi.payPre({
      user_id: authStore.userId || undefined,
      merchant_id: MERCHANT_ID,
    })

    // 2. 调用余额支付接口
    const payResp = await payGateApi.banPay({
      transaction_id: preResp.transaction_id,
      out_order_no: outOrderNo.value,
      merchant_id: MERCHANT_ID,
      user_id: authStore.userId || undefined,
      amount: productInfo.value.price,
      verify_type: 1,
      password: password.value,
    })

    // 3. 支付成功，保存订单到本地
    const now = new Date()
    const order: LocalOrder = {
      transaction_id: preResp.transaction_id,
      out_order_no: outOrderNo.value,
      user_id: authStore.userId || '',
      merchant_id: MERCHANT_ID,
      merchant_name: MERCHANT_NAME,
      product_id: productInfo.value.id,
      product_name: productInfo.value.name,
      product_desc: productInfo.value.desc,
      amount: productInfo.value.price,
      pay_time: now.toISOString().replace('T', ' ').substring(0, 19),
      trade_state: 2,
      order_success_token: payResp.order_success_token,
    }

    saveOrderToLocal(order)

    // 4. 刷新余额
    await authStore.getUserBalance()

    step.value = 'success'
    showToast('支付成功', 'success')
  } catch (error) {
    step.value = 'failed'
    errorMsg.value = (error as Error).message || '支付失败，请重试'
    showToast(errorMsg.value, 'error')
  } finally {
    loading.value = false
  }
}

const retryPay = () => {
  step.value = 'confirm'
  password.value = ''
  errorMsg.value = ''
}

onMounted(async () => {
  if (!productInfo.value.id || !productInfo.value.price) {
    showToast('商品信息无效', 'error')
    setTimeout(() => router.push('/mall'), 1500)
    return
  }
  try {
    await authStore.getUserBalance()
  } catch (e) {
    console.error('加载余额失败:', e)
  }
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-xl mx-auto">
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            :disabled="loading"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">订单支付</h1>
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

      <!-- 支付确认页面 -->
      <div v-if="step === 'confirm'" class="space-y-4 animate-slide-up">
        <div class="card p-6">
          <div class="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div class="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <ShoppingCart class="w-7 h-7 text-white" />
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-gray-800 text-lg">{{ productInfo.name }}</h3>
              <p class="text-sm text-gray-500">{{ productInfo.desc }}</p>
            </div>
          </div>

          <div class="mt-5 space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">商户名称</span>
              <span class="text-sm font-medium text-gray-700">{{ MERCHANT_NAME }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">商户ID</span>
              <span class="text-sm font-medium text-gray-700">{{ MERCHANT_ID }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">购买用户</span>
              <span class="text-sm font-medium text-gray-700">{{ authStore.userId }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
              <span class="text-gray-600 font-medium">应付金额</span>
              <span class="text-2xl font-bold text-primary-600">¥{{ formatPrice(productInfo.price) }}</span>
            </div>
          </div>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <CreditCard class="w-5 h-5 text-primary-600" />
              <h3 class="font-semibold text-gray-800">支付方式</h3>
            </div>
            <span class="text-sm text-primary-600 font-medium">余额支付</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span class="text-sm text-gray-500">当前余额</span>
            <span class="font-semibold text-gray-800">¥{{ formatBalance(authStore.balanceInfo?.balance || 0) }}</span>
          </div>
          <div
            v-if="authStore.balanceInfo && authStore.balanceInfo.balance < productInfo.price"
            class="mt-3 flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-600 text-sm"
          >
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            <span>余额不足，请充值后再支付</span>
          </div>
        </div>

        <div class="card p-6">
          <label class="label">支付密码</label>
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="input-field pl-12 pr-12"
              placeholder="请输入交易密码"
              maxlength="20"
              @keyup.enter="doPay"
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
          @click="doPay"
          :disabled="loading || (authStore.balanceInfo ? authStore.balanceInfo.balance < productInfo.price : false)"
          class="w-full btn-primary py-3.5 text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认支付 ¥{{ formatPrice(productInfo.price) }}
        </button>
      </div>

      <!-- 处理中 -->
      <div v-if="step === 'processing'" class="card p-10 text-center animate-slide-up">
        <Loader2 class="w-16 h-16 text-primary-600 animate-spin mx-auto" />
        <h3 class="text-xl font-semibold text-gray-800 mt-6">支付处理中...</h3>
        <p class="text-gray-500 mt-2">请稍候，正在完成交易</p>
      </div>

      <!-- 支付成功 -->
      <div v-if="step === 'success'" class="card p-10 text-center animate-bounce-in">
        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle class="w-12 h-12 text-green-600" />
        </div>
        <h3 class="text-xl font-bold text-gray-800 mt-6">支付成功！</h3>
        <p class="text-gray-500 mt-2">您已成功购买 {{ productInfo.name }}</p>
        <div class="mt-6 p-4 bg-gray-50 rounded-lg text-left space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">订单金额</span>
            <span class="font-semibold text-gray-800">¥{{ formatPrice(productInfo.price) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">交易单号</span>
            <span class="font-medium text-gray-700 font-mono text-xs">{{ outOrderNo }}</span>
          </div>
        </div>
        <div class="mt-6 grid grid-cols-2 gap-3">
          <button @click="goToMall" class="btn-outline py-3">
            继续购物
          </button>
          <button @click="goToOrders" class="btn-primary py-3">
            查看订单
          </button>
        </div>
      </div>

      <!-- 支付失败 -->
      <div v-if="step === 'failed'" class="card p-10 text-center animate-bounce-in">
        <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle class="w-12 h-12 text-red-600" />
        </div>
        <h3 class="text-xl font-bold text-gray-800 mt-6">支付失败</h3>
        <p class="text-red-500 mt-2">{{ errorMsg }}</p>
        <div class="mt-6 grid grid-cols-2 gap-3">
          <button @click="goToMall" class="btn-outline py-3">
            返回商城
          </button>
          <button @click="retryPay" class="btn-primary py-3">
            重新支付
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
