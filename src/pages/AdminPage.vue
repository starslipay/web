<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { payGateApi } from '@/api/pay_gate'
import type { GetMerchantBalanceInfoRsp } from '@/api/types'
import { ArrowLeft, RefreshCw, Building2, Wallet, Loader2, Zap } from 'lucide-vue-next'
import { useDebugStore } from '@/stores/debug'

const router = useRouter()
const debugStore = useDebugStore()

// 系统已有的商户ID列表(后端user_mgr mock数据, 无列表接口故前端硬编码)
const MERCHANT_IDS = [
  '2000000000', // starslipay虚拟商城商户
  '3000000000', // 淘宝商户
  '4000000000', // 京东商户
  '5000000000', // 拼多多商户
  '6000000000', // 抖音商户
]

const loading = ref(false)
const results = ref<MerchantBalanceRow[]>([])
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

// 查询结果行(成功或失败)
interface MerchantBalanceRow {
  merchant_id: string
  merchant_uid?: number
  merchant_name?: string
  balance?: number
  cur_type?: number
  success: boolean
  error?: string
}

// 金额分转元
const fenToYuan = (fen?: number): string => {
  if (fen === undefined || fen === null) return '-'
  const yuan = fen / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const goBack = () => {
  router.push('/dashboard')
}

// 批量查询所有商户余额
const queryAllMerchants = async () => {
  loading.value = true
  results.value = []
  try {
    const settled = await Promise.allSettled(
      MERCHANT_IDS.map(id => payGateApi.getMerchantBalanceInfo({ merchant_id: id, qry_mode: 2 }))
    )
    const rows: MerchantBalanceRow[] = MERCHANT_IDS.map((id, idx) => {
      const result = settled[idx]
      if (result.status === 'fulfilled') {
        const rsp = result.value as GetMerchantBalanceInfoRsp
        return {
          merchant_id: id,
          merchant_uid: rsp.merchant_uid,
          merchant_name: rsp.merchant_name,
          balance: rsp.balance,
          cur_type: rsp.cur_type,
          success: true,
        }
      }
      return {
        merchant_id: id,
        success: false,
        error: (result.reason as Error)?.message || '查询失败',
      }
    })
    results.value = rows
    const successCount = rows.filter(r => r.success).length
    if (successCount === rows.length) {
      showToast(`成功查询 ${successCount} 个商户余额`, 'success')
    } else {
      showToast(`成功 ${successCount} 个, 失败 ${rows.length - successCount} 个`, 'warning')
    }
  } catch (error) {
    showToast('查询失败: ' + (error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-4xl mx-auto">
      <!-- 页头 -->
      <header class="flex items-center justify-between mb-6 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 class="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-white">管理员</h1>
              <p class="text-sm text-white/70">商户余额查询</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="debugStore.toggleDebugMode"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
              debugStore.isDebugMode
                ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-400/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            ]"
          >
            <Zap class="w-4 h-4" />
            {{ debugStore.isDebugMode ? '调试中' : '调试模式' }}
          </button>
          <button
            @click="queryAllMerchants"
            :disabled="loading"
            class="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <RefreshCw v-else class="w-4 h-4" />
            {{ loading ? '查询中...' : '查询全部' }}
          </button>
        </div>
      </header>

      <!-- 商户列表 -->
      <div class="card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-800">商户列表</h3>
          <span class="text-xs text-gray-500">共 {{ MERCHANT_IDS.length }} 个商户</span>
        </div>

        <div v-if="results.length === 0 && !loading" class="text-center py-10">
          <Building2 class="w-12 h-12 text-gray-300 mx-auto" />
          <p class="text-gray-500 mt-4">点击右上角「查询全部」获取商户信息与余额</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="row in results"
            :key="row.merchant_id"
            class="p-4 rounded-lg border transition-colors"
            :class="row.success ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="row.success ? 'bg-green-100' : 'bg-red-100'"
                >
                  <Wallet class="w-5 h-5" :class="row.success ? 'text-green-600' : 'text-red-600'" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-800">
                    {{ row.merchant_name || '-' }}
                  </p>
                  <p class="text-xs text-gray-500">
                    商户ID: <span class="font-mono">{{ row.merchant_id }}</span>
                    <span v-if="row.merchant_uid" class="ml-2">
                      商户UID: <span class="font-mono">{{ row.merchant_uid }}</span>
                    </span>
                  </p>
                </div>
              </div>
              <div v-if="row.success" class="text-right flex-shrink-0">
                <p class="text-lg font-bold text-blue-600">¥{{ fenToYuan(row.balance) }}</p>
                <p class="text-xs text-gray-500">余额</p>
              </div>
              <div v-else class="text-right flex-shrink-0">
                <p class="text-sm text-red-600 font-medium">查询失败</p>
                <p class="text-xs text-red-400">{{ row.error }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
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
