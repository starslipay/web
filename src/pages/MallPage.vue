<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, ShoppingCart, Zap, Gem, Crown, Star, Rocket, Gift, Zap as ZapIcon, Crown as CrownIcon, Sparkles, Rocket as RocketIcon } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const loading = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

interface VirtualProduct {
  id: string
  name: string
  description: string
  price: number
  icon: any
  gradient: string
  tag?: string
}

const products: VirtualProduct[] = [
  {
    id: 'vip_1',
    name: 'VIP会员月卡',
    description: '享受一个月VIP特权，专属客服，优先体验',
    price: 9900,
    icon: Crown,
    gradient: 'from-yellow-400 to-orange-500',
    tag: '热门',
  },
  {
    id: 'vip_3',
    name: 'VIP会员季卡',
    description: '三个月VIP特权，超值优惠，限时折扣',
    price: 25900,
    icon: CrownIcon,
    gradient: 'from-orange-400 to-red-500',
    tag: '推荐',
  },
  {
    id: 'vip_12',
    name: 'VIP会员年卡',
    description: '全年VIP特权，尊享豪华礼遇，立省三个月',
    price: 88800,
    icon: Gem,
    gradient: 'from-purple-500 to-pink-500',
    tag: '超值',
  },
  {
    id: 'coin_100',
    name: '金币 x100',
    description: '平台通用虚拟货币，可用于各种虚拟服务',
    price: 10000,
    icon: Star,
    gradient: 'from-amber-400 to-yellow-500',
  },
  {
    id: 'coin_500',
    name: '金币 x500',
    description: '大包装金币，额外赠送50金币',
    price: 45000,
    icon: Sparkles,
    gradient: 'from-blue-400 to-indigo-500',
    tag: '赠送',
  },
  {
    id: 'coin_1000',
    name: '金币 x1000',
    description: '豪华金币包，额外赠送200金币',
    price: 80000,
    icon: ZapIcon,
    gradient: 'from-violet-500 to-purple-600',
    tag: '豪礼',
  },
  {
    id: 'svip_1',
    name: 'SVIP至尊月卡',
    description: '至尊VIP特权，专属标识，最高优先级',
    price: 29900,
    icon: Rocket,
    gradient: 'from-rose-500 to-fuchsia-500',
    tag: '至尊',
  },
  {
    id: 'svip_12',
    name: 'SVIP至尊年卡',
    description: '全年至尊VIP，尊享一切特权，年度最佳',
    price: 288800,
    icon: RocketIcon,
    gradient: 'from-red-500 via-pink-500 to-purple-500',
    tag: '年度',
  },
  {
    id: 'gift_small',
    name: '神秘小礼包',
    description: '随机开出稀有道具，惊喜不断',
    price: 1980,
    icon: Gift,
    gradient: 'from-teal-400 to-cyan-500',
  },
]

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const formatBalance = (balance: number) => {
  const yuan = balance / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const formatPrice = (price: number) => {
  const yuan = price / 100
  return yuan.toFixed(2)
}

const goBack = () => {
  router.push('/')
}

const goToOrders = () => {
  router.push('/orders')
}

const buyProduct = async (product: VirtualProduct) => {
  if (!authStore.userId) {
    showToast('请先登录', 'error')
    return
  }

  if (authStore.balanceInfo && authStore.balanceInfo.balance < product.price) {
    showToast(`余额不足，当前余额 ¥${formatBalance(authStore.balanceInfo.balance)}`, 'error')
    return
  }

  router.push({
    path: '/pay',
    query: {
      productId: product.id,
      productName: product.name,
      productPrice: product.price.toString(),
      productDesc: product.description,
    },
  })
}

onMounted(async () => {
  try {
    await authStore.getUserBalance()
  } catch (error) {
    console.error('加载余额失败:', error)
  }
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-5xl mx-auto">
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-white">虚拟商品商城</h1>
            <p class="text-blue-100 mt-1">精选虚拟商品，为您的账户升级</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="goToOrders"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ShoppingCart class="w-4 h-4" />
            我的订单
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

      <div class="card p-6 mb-6 animate-slide-up">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Gem class="w-6 h-6 text-white" />
            </div>
            <div>
              <p class="text-sm text-gray-500">账户余额</p>
              <p class="text-2xl font-bold text-gray-800">
                ¥{{ formatBalance(authStore.balanceInfo?.balance || 0) }}
              </p>
            </div>
          </div>
          <div class="text-sm text-gray-500">
            用户ID: <span class="font-medium text-gray-700">{{ authStore.userId }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(product, index) in products"
          :key="product.id"
          class="card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group animate-slide-up relative overflow-hidden"
          :style="{ animationDelay: `${(index % 6) * 0.1}s` }"
        >
          <div
            v-if="product.tag"
            class="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg"
            :class="`bg-gradient-to-r ${product.gradient}`"
          >
            {{ product.tag }}
          </div>

          <div
            :class="[
              'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform',
              `bg-gradient-to-br ${product.gradient}`
            ]"
          >
            <component :is="product.icon" class="w-7 h-7 text-white" />
          </div>

          <h3 class="font-semibold text-gray-800 text-lg">{{ product.name }}</h3>
          <p class="text-sm text-gray-500 mt-1 min-h-[40px]">{{ product.description }}</p>

          <div class="mt-4 flex items-end justify-between">
            <div>
              <span class="text-xs text-gray-400">¥</span>
              <span class="text-2xl font-bold text-primary-600">{{ formatPrice(product.price) }}</span>
            </div>
            <button
              @click="buyProduct(product)"
              :disabled="loading"
              class="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
            >
              <ShoppingCart class="w-4 h-4" />
              购买
            </button>
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
