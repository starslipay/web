<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Search, Loader2, X, CheckCircle2, Clock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-vue-next'
import { payGateApi } from '@/api/pay_gate'
import type { QueryRechargeWithdrawOrderRsp } from '@/api/types'

const router = useRouter()

const transactionId = ref('')
const loading = ref(false)
const result = ref<QueryRechargeWithdrawOrderRsp | null>(null)
const errorMsg = ref('')

// 业务类型枚举
const bizTypeMap: Record<number, { label: string; icon: typeof TrendingUp; color: string }> = {
  1: { label: '充值', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  2: { label: '提现', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
}

// 交易状态枚举 (充值提现单: 1=初始 2=成功 3=失败)
const tradeStateMap: Record<number, { label: string; textClass: string; bgClass: string; icon: typeof Clock }> = {
  1: { label: '初始', textClass: 'text-yellow-700', bgClass: 'bg-yellow-100', icon: Clock },
  2: { label: '成功', textClass: 'text-green-700', bgClass: 'bg-green-100', icon: CheckCircle2 },
  3: { label: '失败', textClass: 'text-red-700', bgClass: 'bg-red-100', icon: AlertCircle },
}

const getTradeStateInfo = (state: number) => {
  return tradeStateMap[state] || { label: `未知(${state})`, textClass: 'text-gray-700', bgClass: 'bg-gray-100', icon: AlertCircle }
}

const getBizTypeInfo = (type: number) => {
  return bizTypeMap[type] || { label: `未知(${type})`, icon: TrendingUp, color: 'text-gray-600 bg-gray-50' }
}

const fenToYuan = (fen: number) => {
  const yuan = fen / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const handleSearch = async () => {
  if (!transactionId.value.trim()) {
    errorMsg.value = '请输入充值提现单号'
    return
  }
  loading.value = true
  errorMsg.value = ''
  result.value = null
  try {
    result.value = await payGateApi.queryRechargeWithdrawOrder({
      transaction_id: transactionId.value.trim(),
    })
  } catch (e: any) {
    errorMsg.value = e?.message || '查询失败'
  } finally {
    loading.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') handleSearch()
}

const goBack = () => router.back()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
    <div class="max-w-3xl mx-auto">
      <!-- 页头 -->
      <div class="flex items-center gap-4 mb-6">
        <button
          @click="goBack"
          class="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow transition-all"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">查询充值提现单</h1>
          <p class="text-sm text-gray-500 mt-0.5">按交易单号查询充值/提现单据详情</p>
        </div>
      </div>

      <!-- 查询卡片 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">充值提现单号</label>
        <div class="flex gap-3">
          <div class="flex-1 relative">
            <input
              v-model="transactionId"
              type="text"
              placeholder="请输入交易单号 (transaction_id)"
              @keydown="handleKeydown"
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
            />
            <X
              v-if="transactionId"
              @click="transactionId = ''"
              class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer absolute right-3 top-1/2 -translate-y-1/2"
            />
          </div>
          <button
            @click="handleSearch"
            :disabled="loading"
            class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-2"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <Search v-else class="w-4 h-4" />
            查询
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="errorMsg"
        class="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3"
      >
        <AlertCircle class="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p class="text-red-800 font-medium">查询失败</p>
          <p class="text-red-600 text-sm mt-0.5">{{ errorMsg }}</p>
        </div>
      </div>

      <!-- 结果展示 -->
      <template v-if="result">
        <!-- 概览卡片 -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div
                :class="[getBizTypeInfo(result.biz_type).color, 'w-12 h-12 rounded-xl flex items-center justify-center']"
              >
                <component :is="getBizTypeInfo(result.biz_type).icon" class="w-6 h-6" />
              </div>
              <div>
                <p class="text-sm text-gray-500">{{ getBizTypeInfo(result.biz_type).label }}单号</p>
                <p class="text-lg font-semibold text-gray-900 font-mono">{{ result.transaction_id }}</p>
              </div>
            </div>
            <div
              :class="[getTradeStateInfo(result.trade_state).bgClass, getTradeStateInfo(result.trade_state).textClass, 'px-4 py-2 rounded-full flex items-center gap-2 font-medium']"
            >
              <component :is="getTradeStateInfo(result.trade_state).icon" class="w-4 h-4" />
              {{ getTradeStateInfo(result.trade_state).label }}({{ result.trade_state }})
            </div>
          </div>

          <!-- 金额 -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 mb-6">
            <p class="text-sm text-gray-500 mb-1">{{ getBizTypeInfo(result.biz_type).label }}金额</p>
            <p class="text-3xl font-bold text-blue-600">¥{{ fenToYuan(result.amount) }}</p>
          </div>

          <!-- 详情列表 -->
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <p class="text-gray-500 mb-1">业务类型</p>
              <p class="font-medium text-gray-900">{{ getBizTypeInfo(result.biz_type).label }}({{ result.biz_type }})</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">银行类型</p>
              <p class="font-medium text-gray-900">{{ result.bank_type || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">用户ID</p>
              <p class="font-medium text-gray-900 font-mono">{{ result.user_id }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">用户UID <span class="text-amber-500">(生产环境不展示)</span></p>
              <p class="font-medium text-gray-900 font-mono">{{ result.uid }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">银行渠道单号</p>
              <p class="font-medium text-gray-900 font-mono truncate">{{ result.channel_transaction_id || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">币种</p>
              <p class="font-medium text-gray-900">{{ result.cur_type || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">创建时间</p>
              <p class="font-medium text-gray-900">{{ result.create_time || '-' }}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">更新时间</p>
              <p class="font-medium text-gray-900">{{ result.update_time || '-' }}</p>
            </div>
            <div class="col-span-2" v-if="result.memo">
              <p class="text-gray-500 mb-1">备注</p>
              <p class="font-medium text-gray-900">{{ result.memo }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div
        v-if="!result && !errorMsg && !loading"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center"
      >
        <Search class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">输入充值提现单号开始查询</p>
      </div>
    </div>
  </div>
</template>
