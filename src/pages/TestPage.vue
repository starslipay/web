<script setup lang="ts">
import { ref, reactive, computed, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { Users, Clock, Play, Square, RefreshCw, UserPlus, Target, Timer, BarChart3 } from 'lucide-vue-next'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface TestUser {
  userId: string
  password: string
  userToken: string
  balance: number
}

interface TransferResult {
  success: boolean
  duration: number
  error?: string
}

interface TestStats {
  totalRequests: number
  successCount: number
  failCount: number
  totalDuration: number
  maxDuration: number
  minDuration: number
  durations: number[]
}

const apiBase = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const postApi = async (url: string, data: any, token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['user-token'] = token
  }
  const startTime = Date.now()
  try {
    const response = await apiBase.post(url, data, { headers })
    const result = response.data
    const duration = Date.now() - startTime
    if (result.code === 0) {
      return { data: result.data, duration, success: true, error: null }
    } else {
      return { data: null, duration, success: false, error: result.msg || '请求失败' }
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    const msg = error.response?.data?.msg || error.message || '网络错误'
    return { data: null, duration, success: false, error: msg }
  }
}

const userCount = ref(10)
const targetUserId = ref('')
const transferAmount = ref('0.01')
const testVersion = ref(0)
const testDuration = ref(30)
const testMode = ref<'many_to_one' | 'one_to_many'>('many_to_one')

const testUsers = ref<TestUser[]>([])
const generatingUsers = ref(false)
const isRunning = ref(false)
const stopRequested = ref(false)

const stats = reactive<TestStats>({
  totalRequests: 0,
  successCount: 0,
  failCount: 0,
  totalDuration: 0,
  maxDuration: 0,
  minDuration: Infinity,
  durations: [],
})

const remainingTime = ref(0)
let testTimer: ReturnType<typeof setInterval> | null = null

const chartDataPoints = ref<{
  time: string
  qps: number
  avgDuration: number
  successRate: number
  totalRequests: number
}[]>([])

const selectedChartParam = ref('qps')

const chartParams = [
  { value: 'qps', label: 'QPS' },
  { value: 'avgDuration', label: '平均耗时(ms)' },
  { value: 'successRate', label: '成功率(%)' },
  { value: 'totalRequests', label: '累计请求数' },
]

const chartColors: Record<string, string> = {
  qps: '#3B82F6',
  avgDuration: '#EF4444',
  successRate: '#22C55E',
  totalRequests: '#8B5CF6',
}

const chartData = computed(() => ({
  labels: chartDataPoints.value.map(p => p.time),
  datasets: [
    {
      label: chartParams.find(p => p.value === selectedChartParam.value)?.label || '',
      data: chartDataPoints.value.map(p => p[selectedChartParam.value as keyof typeof p] as number),
      borderColor: chartColors[selectedChartParam.value],
      backgroundColor: `${chartColors[selectedChartParam.value]}20`,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 4,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: '时间(秒)',
      },
      grid: {
        display: false,
      },
    },
    y: {
      title: {
        display: true,
        text: chartParams.find(p => p.value === selectedChartParam.value)?.label || '',
      },
      beginAtZero: true,
    },
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false,
  },
}))

const avgDuration = computed(() => {
  if (stats.successCount === 0) return 0
  return Math.round(stats.totalDuration / stats.successCount)
})

const qps = computed(() => {
  const elapsed = (testDuration.value - remainingTime.value) || 1
  return (stats.totalRequests / elapsed).toFixed(2)
})

const p95Duration = computed(() => {
  if (stats.durations.length === 0) return 0
  const sorted = [...stats.durations].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * 0.95)
  return sorted[Math.min(index, sorted.length - 1)]
})

const p99Duration = computed(() => {
  if (stats.durations.length === 0) return 0
  const sorted = [...stats.durations].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * 0.99)
  return sorted[Math.min(index, sorted.length - 1)]
})

const successRate = computed(() => {
  if (stats.totalRequests === 0) return '0.00'
  return ((stats.successCount / stats.totalRequests) * 100).toFixed(2)
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

const generateNumericString = (min: number, max: number): string => {
  const length = Math.floor(Math.random() * (max - min + 1)) + min
  let result = ''
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString()
  }
  return result
}

const generateChineseName = (): string => {
  const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高']
  const givenNames = ['伟', '芳', '敏', '强', '静', '磊', '洋', '勇', '艳', '军', '丽', '涛', '明', '杰', '秀', '娜', '鹏', '磊', '鑫', '欣']
  const surname = surnames[Math.floor(Math.random() * surnames.length)]
  const givenName = givenNames[Math.floor(Math.random() * givenNames.length)]
  return surname + givenName
}

const generatePhone = (): string => {
  const prefixes = ['13', '14', '15', '16', '17', '18', '19']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  let suffix = ''
  for (let i = 0; i < 9; i++) {
    suffix += Math.floor(Math.random() * 10).toString()
  }
  return prefix + suffix
}

const generateEmail = (): string => {
  const domains = ['qq.com', '163.com', 'gmail.com', 'outlook.com', 'yahoo.com', 'sina.com']
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let username = ''
  for (let i = 0; i < 8; i++) {
    username += chars[Math.floor(Math.random() * chars.length)]
  }
  const domain = domains[Math.floor(Math.random() * domains.length)]
  return `${username}@${domain}`
}

const generateAddress = (): string => {
  const provinces = ['北京市', '上海市', '广东省', '浙江省', '江苏省', '山东省', '四川省', '河南省']
  const cities = ['朝阳区', '浦东新区', '天河区', '西湖区', '鼓楼区', '历下区', '锦江区', '金水区']
  const streets = ['街道', '路', '巷', '大道']
  const province = provinces[Math.floor(Math.random() * provinces.length)]
  const city = cities[Math.floor(Math.random() * cities.length)]
  const street = streets[Math.floor(Math.random() * streets.length)]
  const num = Math.floor(Math.random() * 999) + 1
  return `${province}${city}${num}${street}${Math.floor(Math.random() * 99)}号`
}

const generateIdCard = (): string => {
  const regions = ['110000', '120000', '310000', '320000', '330000', '350000', '440000', '420000']
  const region = regions[Math.floor(Math.random() * regions.length)]
  const year = Math.floor(Math.random() * 50) + 1975
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  const checkCode = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'][Math.floor(Math.random() * 11)]
  return `${region}${year}${month}${day}${seq}${checkCode}`
}

const generateUsers = async () => {
  if (userCount.value < 1) {
    showToast('用户数不能小于1', 'error')
    return
  }

  generatingUsers.value = true
  testUsers.value = []

  try {
    const batchSize = 5
    for (let i = 0; i < userCount.value; i += batchSize) {
      const batch = []
      for (let j = i; j < Math.min(i + batchSize, userCount.value); j++) {
        const userId = generateNumericString(5, 64)
        const password = '123456'
        batch.push(createUser(userId, password))
      }
      const results = await Promise.all(batch)
      testUsers.value.push(...results.filter(u => u) as TestUser[])
    }

    showToast(`成功生成 ${testUsers.value.length} 个测试用户`, 'success')
  } catch (error) {
    showToast('生成用户失败', 'error')
  } finally {
    generatingUsers.value = false
  }
}

const createUser = async (userId: string, password: string): Promise<TestUser | null> => {
  try {
    const regResult = await postApi('/api/pay_gate/reg_user', {
      user_id: userId,
      password,
      name: generateChineseName(),
      gender: Math.floor(Math.random() * 2) + 1,
      age: Math.floor(Math.random() * 100) + 1,
      phone: generatePhone(),
      email: generateEmail(),
      address: generateAddress(),
      id_type: 1,
      id_card: generateIdCard(),
    })
    if (!regResult.success) {
      console.warn('注册失败:', userId, regResult.error)
      return null
    }

    const tokenResult = await postApi('/api/pay_gate/get_user_token', {
      user_id: userId,
      password,
    })
    if (!tokenResult.success) {
      console.warn('获取token失败:', userId, tokenResult.error)
      return null
    }

    const preResult = await postApi(
      '/api/pay_gate/bank2c_pre',
      { user_id: userId },
      tokenResult.data.user_token
    )
    if (!preResult.success) {
      console.warn('充值pre失败:', userId, preResult.error)
      return null
    }

    const doResult = await postApi(
      '/api/pay_gate/bank2c_do',
      {
        transaction_id: preResult.data.transaction_id,
        user_id: userId,
        bank_type: 1,
        amount: 1000000,
        desc: '压测资金',
        verify_type: 1,
        password: '123456',
      },
      tokenResult.data.user_token
    )
    if (!doResult.success) {
      console.warn('充值do失败:', userId, doResult.error)
      return null
    }

    const balanceResult = await postApi(
      '/api/pay_gate/get_user_balance_info',
      { user_id: userId },
      tokenResult.data.user_token
    )

    return {
      userId,
      password,
      userToken: tokenResult.data.user_token,
      balance: balanceResult.data?.balance || 0,
    }
  } catch (error) {
    console.error('创建用户异常:', error)
    return null
  }
}

const doTransfer = async (fromUser: TestUser, toUserId: string, amount: number, version: number): Promise<TransferResult> => {
  const startTime = Date.now()
  try {
    const preResult = await postApi(
      '/api/pay_gate/c2c_transfer_pre',
      { buyer_user_id: fromUser.userId },
      fromUser.userToken
    )
    if (!preResult.success) {
      return { success: false, duration: Date.now() - startTime, error: preResult.error || 'pre失败' }
    }

    const doResult = await postApi(
      '/api/pay_gate/c2c_transfer_do',
      {
        transaction_id: preResult.data.transaction_id,
        buyer_user_id: fromUser.userId,
        seller_user_id: toUserId,
        amount,
        verify_type: 1,
        password: fromUser.password,
        version,
      },
      fromUser.userToken
    )

    const duration = Date.now() - startTime
    if (doResult.success) {
      return { success: true, duration }
    } else {
      return { success: false, duration, error: doResult.error || 'do失败' }
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    return { success: false, duration, error: error.message || '异常' }
  }
}

const resetStats = () => {
  stats.totalRequests = 0
  stats.successCount = 0
  stats.failCount = 0
  stats.totalDuration = 0
  stats.maxDuration = 0
  stats.minDuration = Infinity
  stats.durations = []
  chartDataPoints.value = []
}

const runTest = async () => {
  if (testUsers.value.length === 0) {
    showToast('请先生成测试用户', 'error')
    return
  }
  if (testMode.value === 'many_to_one' && !targetUserId.value) {
    showToast('请输入目标用户ID', 'error')
    return
  }
  if (testMode.value === 'one_to_many' && testUsers.value.length < 2) {
    showToast('一对多模式需要至少2个测试用户', 'error')
    return
  }
  if (!transferAmount.value || parseFloat(transferAmount.value) <= 0) {
    showToast('请输入有效转账金额', 'error')
    return
  }
  if (testDuration.value < 1) {
    showToast('压测时间不能小于1秒', 'error')
    return
  }

  isRunning.value = true
  stopRequested.value = false
  resetStats()
  remainingTime.value = testDuration.value

  const amountInCents = Math.round(parseFloat(transferAmount.value) * 100)
  const users = testUsers.value

  const workerPromises: Promise<void>[] = []
  const activeWorkers = new Set<number>()

  const runWorker = async (workerId: number) => {
    activeWorkers.add(workerId)
    while (!stopRequested.value && remainingTime.value > 0) {
      let fromUser: TestUser
      let toUserId: string

      if (testMode.value === 'many_to_one') {
        fromUser = users[Math.floor(Math.random() * users.length)]
        toUserId = targetUserId.value
      } else {
        const fromIndex = Math.floor(Math.random() * users.length)
        fromUser = users[fromIndex]
        let toIndex = Math.floor(Math.random() * users.length)
        while (toIndex === fromIndex) {
          toIndex = Math.floor(Math.random() * users.length)
        }
        toUserId = users[toIndex].userId
      }

      const result = await doTransfer(fromUser, toUserId, amountInCents, testVersion.value)
      
      stats.totalRequests++
      if (result.success) {
        stats.successCount++
        stats.totalDuration += result.duration
        stats.durations.push(result.duration)
        if (result.duration > stats.maxDuration) stats.maxDuration = result.duration
        if (result.duration < stats.minDuration) stats.minDuration = result.duration
      } else {
        stats.failCount++
      }
    }
    activeWorkers.delete(workerId)
  }

  for (let i = 0; i < users.length; i++) {
    workerPromises.push(runWorker(i))
  }

  testTimer = setInterval(() => {
    remainingTime.value--
    const elapsed = testDuration.value - remainingTime.value
    chartDataPoints.value.push({
      time: `${elapsed}s`,
      qps: parseFloat(qps.value),
      avgDuration: avgDuration.value,
      successRate: parseFloat(successRate.value),
      totalRequests: stats.totalRequests,
    })
    if (remainingTime.value <= 0) {
      stopTest()
    }
  }, 1000)

  await Promise.all(workerPromises)
  
  if (testTimer) {
    clearInterval(testTimer)
    testTimer = null
  }
  
  isRunning.value = false
  stopRequested.value = false
  
  if (stats.minDuration === Infinity) stats.minDuration = 0
  showToast('压测完成', 'success')
}

const stopTest = () => {
  stopRequested.value = true
}

onUnmounted(() => {
  if (testTimer) {
    clearInterval(testTimer)
  }
  stopRequested.value = true
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-6">
    <div class="max-w-6xl mx-auto">
      <header class="text-center mb-6 sm:mb-8 animate-fade-in">
        <h1 class="text-2xl sm:text-3xl font-bold text-white">压测中心</h1>
        <p class="text-white/60 mt-2">C2C转账性能测试工具</p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card p-6 animate-slide-up">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <UserPlus class="w-5 h-5 text-primary-600" />
              测试用户
            </h2>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">用户数量</label>
                <input
                  v-model.number="userCount"
                  type="number"
                  min="1"
                  max="100"
                  class="input-field"
                  :disabled="isRunning || generatingUsers"
                />
              </div>
              <div class="flex items-end">
                <button
                  @click="generateUsers"
                  :disabled="isRunning || generatingUsers"
                  class="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <RefreshCw v-if="generatingUsers" class="w-4 h-4 animate-spin" />
                  <UserPlus v-else class="w-4 h-4" />
                  {{ generatingUsers ? '生成中...' : '一键生成用户' }}
                </button>
              </div>
            </div>

            <div v-if="testUsers.length > 0" class="border-t border-gray-100 pt-4">
              <p class="text-sm text-gray-500 mb-2">已生成 {{ testUsers.length }} 个测试用户</p>
              <div class="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
                <div
                  v-for="user in testUsers"
                  :key="user.userId"
                  class="text-xs text-gray-600 flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded"
                >
                  <span class="font-mono">{{ user.userId }}</span>
                  <span class="text-gray-400">余额: ¥{{ (user.balance / 100).toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card p-6 animate-slide-up" style="animation-delay: 0.1s">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Target class="w-5 h-5 text-primary-600" />
              压测配置
            </h2>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="label">压测模式</label>
                <select v-model="testMode" class="input-field" :disabled="isRunning">
                  <option value="many_to_one">多对一（多个C向一个C转账）</option>
                  <option value="one_to_many">一对多（一个C向多个C转账）</option>
                </select>
              </div>
              <div v-if="testMode === 'many_to_one'">
                <label class="label">目标用户ID（收款人）</label>
                <input
                  v-model="targetUserId"
                  type="text"
                  class="input-field"
                  placeholder="请输入收款用户ID"
                  :disabled="isRunning"
                />
              </div>
              <div>
                <label class="label">转账金额（元）</label>
                <input
                  v-model="transferAmount"
                  type="text"
                  class="input-field"
                  placeholder="请输入转账金额"
                  :disabled="isRunning"
                />
              </div>
              <div>
                <label class="label">入账方式</label>
                <select v-model="testVersion" class="input-field" :disabled="isRunning">
                  <option :value="0">同步入账 (version=0)</option>
                  <option :value="1">异步入账 (version=1)</option>
                </select>
              </div>
              <div>
                <label class="label">压测时间（秒）</label>
                <input
                  v-model.number="testDuration"
                  type="number"
                  min="1"
                  max="3600"
                  class="input-field"
                  :disabled="isRunning"
                />
              </div>
            </div>

            <div class="mt-6 flex gap-4">
              <button
                v-if="!isRunning"
                @click="runTest"
                class="flex-1 btn-success py-3 text-lg flex items-center justify-center gap-2"
              >
                <Play class="w-5 h-5" />
                开始压测
              </button>
              <button
                v-else
                @click="stopTest"
                class="flex-1 btn-danger py-3 text-lg flex items-center justify-center gap-2"
              >
                <Square class="w-5 h-5" />
                停止压测
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="card p-6 animate-slide-up" style="animation-delay: 0.2s">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Timer class="w-5 h-5 text-primary-600" />
              运行状态
            </h2>
            
            <div class="text-center mb-4">
              <div class="text-5xl font-bold text-gray-800 font-mono">
                {{ remainingTime }}
              </div>
              <p class="text-gray-500 mt-1">剩余时间（秒）</p>
            </div>

            <div class="flex items-center justify-center gap-2">
              <div :class="['w-3 h-3 rounded-full', isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300']" />
              <span class="text-sm text-gray-600">{{ isRunning ? '运行中' : '未开始' }}</span>
            </div>
          </div>

          <div class="card p-6 animate-slide-up" style="animation-delay: 0.3s">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 class="w-5 h-5 text-primary-600" />
              统计结果
            </h2>
            
            <div class="space-y-4">
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">总请求数</span>
                <span class="font-semibold text-gray-800">{{ stats.totalRequests }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">成功数</span>
                <span class="font-semibold text-green-600">{{ stats.successCount }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">失败数</span>
                <span class="font-semibold text-red-600">{{ stats.failCount }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">成功率</span>
                <span class="font-semibold text-primary-600">{{ successRate }}%</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">QPS</span>
                <span class="font-semibold text-gray-800">{{ qps }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">平均耗时</span>
                <span class="font-semibold text-gray-800">{{ avgDuration }}ms</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">最大耗时</span>
                <span class="font-semibold text-red-600">{{ stats.maxDuration }}ms</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">最小耗时</span>
                <span class="font-semibold text-green-600">{{ stats.minDuration === Infinity ? 0 : stats.minDuration }}ms</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-500 text-sm">P95 耗时</span>
                <span class="font-semibold text-yellow-600">{{ p95Duration }}ms</span>
              </div>
              <div class="flex justify-between items-center py-2">
                <span class="text-gray-500 text-sm">P99 耗时</span>
                <span class="font-semibold text-orange-600">{{ p99Duration }}ms</span>
              </div>
            </div>
          </div>

          <div class="card p-6 animate-slide-up" style="animation-delay: 0.4s">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 class="w-5 h-5 text-primary-600" />
              实时趋势图
            </h2>
            
            <div class="flex gap-2 mb-4">
              <button
                v-for="param in chartParams"
                :key="param.value"
                @click="selectedChartParam = param.value"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  selectedChartParam === param.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                ]"
              >
                {{ param.label }}
              </button>
            </div>

            <div class="h-64">
              <Line v-if="chartDataPoints.length > 0" :data="chartData" :options="chartOptions" />
              <div v-else class="h-full flex items-center justify-center text-gray-400">
                开始压测后将显示实时趋势图
              </div>
            </div>
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
