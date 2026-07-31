<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import type { GetOrderInfoRsp } from '@/api/types'
import { ArrowLeft, ClipboardList, ShoppingCart, RefreshCw, X, CheckCircle, Clock, Loader2, Zap, FileText, User as UserIcon, Building, Hash, Calendar, Banknote } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const refreshing = ref(false)
const selectedOrder = ref<any>(null)
const showDetailModal = ref(false)
const loadingDetail = ref(false)

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

interface OrderDetail extends GetOrderInfoRsp {
  product_name?: string
  product_desc?: string
}

const orders = ref<LocalOrder[]>([])

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

const tradeStateMap: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '待支付', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  2: { label: '支付成功', color: 'text-green-700', bg: 'bg-green-100' },
  99: { label: '已关闭', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const getTradeStateInfo = (state: number) => {
  return tradeStateMap[state] || { label: `状态${state}`, color: 'text-gray-700', bg: 'bg-gray-100' }
}

const goBack = () => {
  router.push('/')
}

const goToMall = () => {
  router.push('/mall')
}

const loadOrders = () => {
  const key = `mall_orders_${authStore.userId}`
  try {
    const stored = localStorage.getItem(key)
    orders.value = stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('加载订单失败:', e)
    orders.value = []
  }
}

const refreshOrders = async () => {
  refreshing.value = true
  try {
    loadOrders()
    showToast('订单列表已刷新', 'success')
  } finally {
    refreshing.value = false
  }
}

const viewOrderDetail = async (order: LocalOrder) => {
  selectedOrder.value = order
  showDetailModal.value = true
  loadingDetail.value = true

  try {
    // 调用后端查询订单接口
    const resp = await payGateApi.getOrderInfo({
      transaction_id: order.transaction_id,
    })

    // 合并后端返回的数据和本地的商品信息
    selectedOrder.value = {
      ...resp,
      product_name: order.product_name,
      product_desc: order.product_desc,
    } as OrderDetail

    // 更新本地订单状态（如果后端返回了新状态）
    const localIndex = orders.value.findIndex(o => o.transaction_id === resp.transaction_id)
    if (localIndex >= 0) {
      orders.value[localIndex].trade_state = resp.trade_state
      orders.value[localIndex].pay_time = resp.pay_time || orders.value[localIndex].pay_time
      const key = `mall_orders_${authStore.userId}`
      localStorage.setItem(key, JSON.stringify(orders.value))
    }
  } catch (error) {
    // 如果后端查询失败，继续使用本地数据
    const msg = (error as Error).message || '查询订单详情失败，显示本地数据'
    console.warn(msg)
  } finally {
    loadingDetail.value = false
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedOrder.value = null
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-4xl mx-auto">
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-white">我的订单</h1>
            <p class="text-blue-100 mt-1">商城订单记录，共 {{ orders.length }} 笔</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="refreshOrders"
            :disabled="refreshing"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw :class="['w-4 h-4', refreshing ? 'animate-spin' : '']" />
            刷新
          </button>

          <button
            @click="goToMall"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ShoppingCart class="w-4 h-4" />
            去商城
          </button>

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
        </div>
      </header>

      <div v-if="orders.length === 0" class="card p-16 text-center animate-slide-up">
        <ClipboardList class="w-20 h-20 text-gray-300 mx-auto" />
        <h3 class="text-xl font-semibold text-gray-800 mt-6">暂无订单</h3>
        <p class="text-gray-500 mt-2">快去商城挑选喜欢的商品吧</p>
        <button
          @click="goToMall"
          class="btn-primary mt-6 inline-flex items-center gap-2"
        >
          <ShoppingCart class="w-4 h-4" />
          前往商城
        </button>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(order, index) in orders"
          :key="order.transaction_id"
          @click="viewOrderDetail(order)"
          class="card p-5 hover:shadow-xl transition-all duration-200 cursor-pointer animate-slide-up group"
          :style="{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <h3 class="font-semibold text-gray-800 truncate">{{ order.product_name }}</h3>
                <span
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    getTradeStateInfo(order.trade_state).bg,
                    getTradeStateInfo(order.trade_state).color,
                  ]"
                >
                  <CheckCircle v-if="order.trade_state === 2" class="w-3 h-3 mr-1" />
                  <Clock v-else-if="order.trade_state === 1" class="w-3 h-3 mr-1" />
                  {{ getTradeStateInfo(order.trade_state).label }}
                </span>
              </div>
              <p class="text-sm text-gray-500 mt-1 truncate">{{ order.product_desc }}</p>
              <div class="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <div class="flex items-center gap-1">
                  <Hash class="w-3 h-3" />
                  <span class="font-mono truncate max-w-[160px]">{{ order.transaction_id }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Calendar class="w-3 h-3" />
                  <span>{{ order.pay_time }}</span>
                </div>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-xl font-bold text-primary-600">¥{{ formatPrice(order.amount) }}</div>
              <div class="text-xs text-gray-400 mt-1 group-hover:text-primary-600 transition-colors flex items-center justify-end gap-1">
                <FileText class="w-3 h-3" />
                查看详情
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 订单详情弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showDetailModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          @click.self="closeDetailModal"
        >
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-bounce-in">
            <div class="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 class="text-lg font-bold text-gray-800">订单详情</h3>
              <button
                @click="closeDetailModal"
                class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div v-if="loadingDetail" class="p-10 text-center">
              <Loader2 class="w-10 h-10 text-primary-600 animate-spin mx-auto" />
              <p class="text-gray-500 mt-4">正在加载订单详情...</p>
            </div>

            <div v-else class="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              <!-- 商品信息 -->
              <div class="p-4 bg-gradient-to-br from-primary-50 to-pink-50 rounded-xl">
                <div class="flex items-center justify-between">
                  <h4 class="font-semibold text-gray-800">{{ selectedOrder?.product_name || '-' }}</h4>
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-1 rounded text-xs font-medium',
                      getTradeStateInfo(selectedOrder?.trade_state || 1).bg,
                  getTradeStateInfo(selectedOrder?.trade_state || 1).color,
                    ]"
                  >
                    {{ getTradeStateInfo(selectedOrder?.trade_state || 1).label }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 mt-1">{{ selectedOrder?.product_desc || '-' }}</p>
              </div>

              <!-- 金额 -->
              <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div class="flex items-center gap-2">
                  <Banknote class="w-5 h-5 text-primary-600" />
                  <span class="text-gray-600">订单金额</span>
                </div>
                <span class="text-2xl font-bold text-primary-600">¥{{ formatPrice(selectedOrder?.amount || 0) }}</span>
              </div>

              <!-- 详细信息 -->
              <div class="space-y-3 text-sm">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <UserIcon class="w-4 h-4" />
                    <span>用户ID</span>
                  </div>
                  <span class="text-gray-800 font-medium text-right">{{ selectedOrder?.user_id || '-' }}</span>
                </div>

                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <Building class="w-4 h-4" />
                    <span>商户信息</span>
                  </div>
                  <div class="text-right">
                    <div class="text-gray-800 font-medium">{{ selectedOrder?.merchant_name || '-' }}</div>
                    <div class="text-xs text-gray-400 font-mono">{{ selectedOrder?.merchant_id || '-' }}</div>
                  </div>
                </div>

                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <Hash class="w-4 h-4" />
                    <span>交易单号</span>
                  </div>
                  <span class="text-gray-800 font-medium text-right font-mono text-xs break-all">{{ selectedOrder?.transaction_id || '-' }}</span>
                </div>

                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <FileText class="w-4 h-4" />
                    <span>商户订单号</span>
                  </div>
                  <span class="text-gray-800 font-medium text-right font-mono text-xs break-all">{{ selectedOrder?.out_order_no || '-' }}</span>
                </div>

                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <Calendar class="w-4 h-4" />
                    <span>支付时间</span>
                  </div>
                  <span class="text-gray-800 font-medium text-right">{{ selectedOrder?.pay_time || '-' }}</span>
                </div>

                <div v-if="selectedOrder?.order_success_token" class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 text-gray-500 flex-shrink-0">
                    <CheckCircle class="w-4 h-4" />
                    <span>成功凭证</span>
                  </div>
                  <span class="text-gray-800 font-medium text-right font-mono text-xs break-all max-w-[200px]">{{ selectedOrder.order_success_token }}</span>
                </div>
              </div>
            </div>

            <div class="p-5 border-t border-gray-100">
              <button
                @click="closeDetailModal"
                class="w-full btn-primary py-3"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.9); }
  50% { transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}

.animate-bounce-in {
  animation: bounceIn 0.3s ease-out;
}

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
