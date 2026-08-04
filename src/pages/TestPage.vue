<script setup lang="ts">
import { ref, reactive, computed, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { Users, Clock, Play, Square, RefreshCw, UserPlus, Target, Timer, BarChart3, ChevronRight } from 'lucide-vue-next'
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

const STRESS_BUSINESS_INFO = 'web_stress_test'

const postApi = async (url: string, data: any, token?: string, userId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'BusinessInfo': STRESS_BUSINESS_INFO,
  }
  if (token) {
    headers['UserToken'] = token
  }
  if (userId) {
    headers['UserId'] = userId
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

const getApi = async (url: string, token?: string, userId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'BusinessInfo': STRESS_BUSINESS_INFO,
  }
  if (token) {
    headers['UserToken'] = token
  }
  if (userId) {
    headers['UserId'] = userId
  }
  const startTime = Date.now()
  try {
    const response = await apiBase.get(url, { headers })
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
const payAmount = ref('0.01')
const testVersion = ref(0)
const testDuration = ref(30)
const testMode = ref<'many_to_one' | 'one_to_many' | 'query_balance' | 'pay' | 'smoke_test'>('many_to_one')

const PAY_MERCHANT_ID = '2000000000'

const testUsers = ref<TestUser[]>([])
const generatingUsers = ref(false)
const isRunning = ref(false)
const stopRequested = ref(false)

interface SmokeCheck {
  label: string
  pass: boolean
  expected: any
  actual: any
}

interface SmokeStep {
  name: string
  api: string
  status: 'pending' | 'running' | 'success' | 'fail' | 'skip'
  duration: number
  message: string
  request: any
  response: any
  checks: SmokeCheck[]
  expanded: boolean
}

const smokeSteps = ref<SmokeStep[]>([])
const smokeRunning = ref(false)

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
    }, undefined, userId)
    if (!regResult.success) {
      console.warn('注册失败:', userId, regResult.error)
      return null
    }

    const tokenResult = await postApi('/api/pay_gate/get_user_token', {
      user_id: userId,
      password,
      business_info: STRESS_BUSINESS_INFO,
    }, undefined, userId)
    if (!tokenResult.success) {
      console.warn('获取token失败:', userId, tokenResult.error)
      return null
    }

    const preResult = await postApi(
      '/api/pay_gate/bank2c_pre',
      { user_id: userId },
      tokenResult.data.user_token,
      userId
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
      tokenResult.data.user_token,
      userId
    )
    if (!doResult.success) {
      console.warn('充值do失败:', userId, doResult.error)
      return null
    }

    const balanceResult = await postApi(
      '/api/pay_gate/get_user_balance_info',
      { user_id: userId },
      tokenResult.data.user_token,
      userId
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
      fromUser.userToken,
      fromUser.userId
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
      fromUser.userToken,
      fromUser.userId
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

const doQueryBalance = async (user: TestUser): Promise<TransferResult> => {
  const startTime = Date.now()
  try {
    const result = await postApi(
      '/api/pay_gate/get_user_balance_info',
      { user_id: user.userId },
      user.userToken,
      user.userId
    )
    const duration = Date.now() - startTime
    if (result.success) {
      return { success: true, duration }
    } else {
      return { success: false, duration, error: result.error || '查询失败' }
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    return { success: false, duration, error: error.message || '异常' }
  }
}

const doPay = async (user: TestUser, amount: number): Promise<TransferResult> => {
  const startTime = Date.now()
  try {
    const preResult = await postApi(
      '/api/pay_gate/pay_re',
      { user_id: user.userId, merchant_id: PAY_MERCHANT_ID },
      user.userToken,
      user.userId
    )
    if (!preResult.success) {
      return { success: false, duration: Date.now() - startTime, error: preResult.error || 'pre失败' }
    }

    const outOrderNo = generateNumericString(32, 32)
    const payResult = await postApi(
      '/api/pay_gate/ban_pay',
      {
        transaction_id: preResult.data.transaction_id,
        out_order_no: outOrderNo,
        merchant_id: PAY_MERCHANT_ID,
        user_id: user.userId,
        amount,
        verify_type: 1,
        password: user.password,
      },
      user.userToken,
      user.userId
    )

    const duration = Date.now() - startTime
    if (payResult.success) {
      return { success: true, duration }
    } else {
      return { success: false, duration, error: payResult.error || 'pay失败' }
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

const runSmokeTest = async () => {
  if (smokeRunning.value) return
  smokeRunning.value = true

  // 定义全流程步骤（按依赖顺序串联所有接口）
  const mk = (name: string, api: string): SmokeStep => ({
    name, api, status: 'pending', duration: 0, message: '', request: null, response: null, checks: [], expanded: false,
  })
  const steps: SmokeStep[] = [
    mk('健康检查', 'GET /health'),
    mk('注册用户(买家)', 'POST /reg_user'),
    mk('获取Token(买家)', 'POST /get_user_token'),
    mk('注册用户(卖家)', 'POST /reg_user'),
    mk('获取Token(卖家)', 'POST /get_user_token'),
    mk('更新用户信息', 'POST /update_user_info'),
    mk('查询用户信息', 'POST /get_user_info'),
    mk('银行转C-下单(充值)', 'POST /bank2c_pre'),
    mk('银行转C-确认(充值)', 'POST /bank2c_do'),
    mk('查询余额', 'POST /get_user_balance_info'),
    mk('C2C转账-下单', 'POST /c2c_transfer_pre'),
    mk('C2C转账-确认', 'POST /c2c_transfer_do'),
    mk('查询C2C账单', 'POST /get_c2c_bill'),
    mk('C转银行-下单(提现)', 'POST /c2bank_pre'),
    mk('C转银行-确认(提现)', 'POST /c2bank_do'),
    mk('支付-下单', 'POST /pay_re'),
    mk('余额支付', 'POST /ban_pay'),
    mk('查询订单信息', 'POST /get_order_info'),
    mk('关闭/补单', 'POST /close_or_supply_order'),
    mk('查询用户流水', 'POST /get_user_flow'),
  ]
  smokeSteps.value = steps

  // 上下文数据，在步骤间传递
  const password = '123456'
  const buyerId = generateNumericString(10, 20)
  const sellerId = generateNumericString(10, 20)
  const ctx: Record<string, any> = {}
  let aborted = false

  // 生成一条相等校验
  const eq = (label: string, expected: any, actual: any): SmokeCheck => ({
    label, expected, actual, pass: String(expected) === String(actual),
  })
  // 生成一条非空校验
  const notEmpty = (label: string, actual: any): SmokeCheck => ({
    label, expected: '非空', actual, pass: actual !== undefined && actual !== null && actual !== '',
  })

  // 执行单个步骤：request 为请求参数(值或惰性函数，用于展示)，
  // fn 返回 {success, data, error, duration}，validate 对返回 data 做业务校验
  const exec = async (
    index: number,
    request: any,
    fn: () => Promise<{ success: boolean; data?: any; error?: any; duration: number }>,
    validate?: (data: any, req: any) => SmokeCheck[]
  ) => {
    const step = steps[index]
    step.request = typeof request === 'function' ? request() : request
    step.status = 'running'
    if (aborted) {
      step.status = 'skip'
      step.message = '前置步骤失败，已跳过'
      return false
    }
    try {
      const res = await fn()
      step.duration = res.duration
      step.response = res.success ? res.data : { error: res.error }
      if (!res.success) {
        step.status = 'fail'
        step.message = res.error || '失败'
        aborted = true
        return false
      }
      // 请求成功，执行业务参数校验
      if (validate) {
        step.checks = validate(res.data, step.request) || []
      }
      const failedChecks = step.checks.filter(c => !c.pass)
      if (failedChecks.length > 0) {
        step.status = 'fail'
        step.message = `业务校验失败：${failedChecks.map(c => c.label).join('、')}`
        aborted = true
        return false
      }
      step.status = 'success'
      step.message = step.checks.length > 0 ? `成功（${step.checks.length}项校验通过）` : '成功'
      return true
    } catch (e: any) {
      step.status = 'fail'
      step.message = e?.message || '异常'
      step.response = { error: step.message }
      aborted = true
      return false
    }
  }

  // 预期余额跟踪（买家初始为0）
  let expectedBalance = 0
  const RECHARGE_AMOUNT = 1000000
  const C2C_AMOUNT = 100
  const WITHDRAW_AMOUNT = 100
  const PAY_AMOUNT = 100

  // 1. 健康检查
  await exec(0, {}, () => getApi('/api/pay_gate/health'))

  // 2. 注册买家
  const regBuyerReq = {
    user_id: buyerId, password, name: generateChineseName(), gender: 1, age: 25,
    phone: generatePhone(), email: generateEmail(), address: generateAddress(), id_type: 1, id_card: generateIdCard(),
  }
  await exec(1, regBuyerReq, () => postApi('/api/pay_gate/reg_user', regBuyerReq, undefined, buyerId),
    (d, req) => [eq('返回user_id与请求一致', req.user_id, d.user_id)])

  // 3. 买家Token
  const tokenBuyerReq = { user_id: buyerId, password, business_info: STRESS_BUSINESS_INFO }
  await exec(2, tokenBuyerReq, async () => {
    const r = await postApi('/api/pay_gate/get_user_token', tokenBuyerReq, undefined, buyerId)
    if (r.success) ctx.buyerToken = r.data.user_token
    return r
  }, (d, req) => [
    eq('返回user_id与请求一致', req.user_id, d.user_id),
    notEmpty('user_token非空', d.user_token),
  ])

  // 4. 注册卖家
  const regSellerReq = {
    user_id: sellerId, password, name: generateChineseName(), gender: 1, age: 26,
    phone: generatePhone(), email: generateEmail(), address: generateAddress(), id_type: 1, id_card: generateIdCard(),
  }
  await exec(3, regSellerReq, () => postApi('/api/pay_gate/reg_user', regSellerReq, undefined, sellerId),
    (d, req) => [eq('返回user_id与请求一致', req.user_id, d.user_id)])

  // 5. 卖家Token
  const tokenSellerReq = { user_id: sellerId, password, business_info: STRESS_BUSINESS_INFO }
  await exec(4, tokenSellerReq, async () => {
    const r = await postApi('/api/pay_gate/get_user_token', tokenSellerReq, undefined, sellerId)
    if (r.success) ctx.sellerToken = r.data.user_token
    return r
  }, (d, req) => [
    eq('返回user_id与请求一致', req.user_id, d.user_id),
    notEmpty('user_token非空', d.user_token),
  ])

  // 6. 更新用户信息(买家)
  const updateReq = {
    user_id: buyerId, name: generateChineseName(), gender: 2, age: 30, address: generateAddress(),
    phone: generatePhone(), email: generateEmail(), id_type: 1, id_card: generateIdCard(),
  }
  await exec(5, updateReq, () => postApi('/api/pay_gate/update_user_info', updateReq, ctx.buyerToken, buyerId),
    (d, req) => [eq('返回user_id与请求一致', req.user_id, d.user_id)])

  // 7. 查询用户信息(买家)：校验返回信息与刚更新的一致
  const getUserInfoReq = { user_id: buyerId }
  await exec(6, getUserInfoReq, () => postApi('/api/pay_gate/get_user_info', getUserInfoReq, ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回user_id与请求一致', req.user_id, d.user_id),
      eq('姓名与更新值一致', updateReq.name, d.name),
      eq('手机号与更新值一致', updateReq.phone, d.phone),
    ])

  // 8. 充值下单
  const rechargePreReq = { user_id: buyerId }
  await exec(7, rechargePreReq, async () => {
    const r = await postApi('/api/pay_gate/bank2c_pre', rechargePreReq, ctx.buyerToken, buyerId)
    if (r.success) ctx.rechargeTid = r.data.transaction_id
    return r
  }, (d, req) => [
    eq('返回user_id与请求一致', req.user_id, d.user_id),
    notEmpty('transaction_id非空', d.transaction_id),
  ])

  // 9. 充值确认
  const rechargeDoReq = () => ({
    transaction_id: ctx.rechargeTid, user_id: buyerId, bank_type: 1, amount: RECHARGE_AMOUNT,
    desc: '冒烟测试充值', verify_type: 1, password,
  })
  const rechargeOk = await exec(8, rechargeDoReq, () => postApi('/api/pay_gate/bank2c_do', rechargeDoReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('返回user_id与请求一致', req.user_id, d.user_id),
    ])
  if (rechargeOk) expectedBalance += RECHARGE_AMOUNT

  // 10. 查询余额：校验余额变化符合预期（=充值金额）
  const balanceReq = { user_id: buyerId }
  await exec(9, balanceReq, () => postApi('/api/pay_gate/get_user_balance_info', balanceReq, ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回user_id与请求一致', req.user_id, d.user_id),
      eq(`余额变化符合预期(充值后=${expectedBalance})`, expectedBalance, d.balance),
    ])

  // 11. C2C转账下单
  const c2cPreReq = { buyer_user_id: buyerId }
  await exec(10, c2cPreReq, async () => {
    const r = await postApi('/api/pay_gate/c2c_transfer_pre', c2cPreReq, ctx.buyerToken, buyerId)
    if (r.success) ctx.c2cTid = r.data.transaction_id
    return r
  }, (d, req) => [
    eq('返回buyer_user_id与请求一致', req.buyer_user_id, d.buyer_user_id),
    notEmpty('transaction_id非空', d.transaction_id),
  ])

  // 12. C2C转账确认
  const c2cDoReq = () => ({
    transaction_id: ctx.c2cTid, buyer_user_id: buyerId, seller_user_id: sellerId,
    amount: C2C_AMOUNT, verify_type: 1, password, version: 0,
  })
  const c2cOk = await exec(11, c2cDoReq, () => postApi('/api/pay_gate/c2c_transfer_do', c2cDoReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('返回buyer_user_id与请求一致', req.buyer_user_id, d.buyer_user_id),
      eq('返回seller_user_id与请求一致', req.seller_user_id, d.seller_user_id),
    ])
  if (c2cOk) expectedBalance -= C2C_AMOUNT

  // 13. 查询C2C账单：校验单号、买卖双方、金额一致
  const c2cBillReq = () => ({ transaction_id: ctx.c2cTid })
  await exec(12, c2cBillReq, () => postApi('/api/pay_gate/get_c2c_bill', c2cBillReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('buyer_user_id为买家', buyerId, d.buyer_user_id),
      eq('seller_user_id为卖家', sellerId, d.seller_user_id),
      eq('金额与转账一致', C2C_AMOUNT, d.amount),
    ])

  // 14. 提现下单
  const withdrawPreReq = { user_id: buyerId }
  await exec(13, withdrawPreReq, async () => {
    const r = await postApi('/api/pay_gate/c2bank_pre', withdrawPreReq, ctx.buyerToken, buyerId)
    if (r.success) ctx.withdrawTid = r.data.transaction_id
    return r
  }, (d, req) => [
    eq('返回user_id与请求一致', req.user_id, d.user_id),
    notEmpty('transaction_id非空', d.transaction_id),
  ])

  // 15. 提现确认
  const withdrawDoReq = () => ({
    transaction_id: ctx.withdrawTid, user_id: buyerId, bank_type: 1, amount: WITHDRAW_AMOUNT,
    desc: '冒烟测试提现', verify_type: 1, password,
  })
  const withdrawOk = await exec(14, withdrawDoReq, () => postApi('/api/pay_gate/c2bank_do', withdrawDoReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('返回user_id与请求一致', req.user_id, d.user_id),
    ])
  if (withdrawOk) expectedBalance -= WITHDRAW_AMOUNT

  // 16. 支付下单
  const outOrderNo = generateNumericString(32, 32)
  const payPreReq = { user_id: buyerId, merchant_id: PAY_MERCHANT_ID }
  await exec(15, payPreReq, async () => {
    const r = await postApi('/api/pay_gate/pay_re', payPreReq, ctx.buyerToken, buyerId)
    if (r.success) ctx.payTid = r.data.transaction_id
    return r
  }, (d, req) => [
    eq('返回user_id与请求一致', req.user_id, d.user_id),
    notEmpty('transaction_id非空', d.transaction_id),
  ])

  // 17. 余额支付：校验单号/商户/用户/金额一致
  const banPayReq = () => ({
    transaction_id: ctx.payTid, out_order_no: outOrderNo, merchant_id: PAY_MERCHANT_ID,
    user_id: buyerId, amount: PAY_AMOUNT, verify_type: 1, password,
  })
  const payOk = await exec(16, banPayReq, () => postApi('/api/pay_gate/ban_pay', banPayReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('返回out_order_no与请求一致', req.out_order_no, d.out_order_no),
      eq('返回merchant_id与请求一致', req.merchant_id, d.merchant_id),
      eq('返回user_id与请求一致', req.user_id, d.user_id),
      eq('返回amount与请求一致', req.amount, d.amount),
    ])
  if (payOk) expectedBalance -= PAY_AMOUNT

  // 18. 查询订单信息：校验单号/商户/用户/金额一致，交易状态为已支付(2)
  const orderInfoReq = () => ({ transaction_id: ctx.payTid })
  await exec(17, orderInfoReq, () => postApi('/api/pay_gate/get_order_info', orderInfoReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('out_order_no与支付单号一致', outOrderNo, d.out_order_no),
      eq('merchant_id与支付商户一致', PAY_MERCHANT_ID, d.merchant_id),
      eq('返回user_id为买家', buyerId, d.user_id),
      eq('金额与支付一致', PAY_AMOUNT, d.amount),
      eq('交易状态为支付成功(2)', 2, d.trade_state),
    ])

  // 19. 关闭/补单：校验单号一致
  const closeReq = () => ({
    transaction_id: ctx.payTid, out_order_no: outOrderNo, merchant_id: PAY_MERCHANT_ID,
    user_id: buyerId, amount: PAY_AMOUNT,
  })
  await exec(18, closeReq, () => postApi('/api/pay_gate/close_or_supply_order', closeReq(), ctx.buyerToken, buyerId),
    (d, req) => [
      eq('返回transaction_id与请求一致', req.transaction_id, d.transaction_id),
      eq('返回out_order_no与请求一致', req.out_order_no, d.out_order_no),
      eq('返回user_id与请求一致', req.user_id, d.user_id),
    ])

  // 20. 查询用户流水：校验返回user_id一致
  const flowReq = { user_id: buyerId, offset: 0, limit: 10 }
  await exec(19, flowReq, () => postApi('/api/pay_gate/get_user_flow', flowReq, ctx.buyerToken, buyerId),
    (d, req) => [eq('返回user_id与请求一致', req.user_id, d.user_id)])

  smokeRunning.value = false

  const failed = steps.filter(s => s.status === 'fail').length
  const skipped = steps.filter(s => s.status === 'skip').length
  if (failed === 0 && skipped === 0) {
    showToast('全部接口测试通过 ✓', 'success')
  } else {
    showToast(`测试完成：${failed} 个失败，${skipped} 个跳过`, failed > 0 ? 'error' : 'warning')
  }
}

const runTest = async () => {
  if (testMode.value === 'smoke_test') {
    await runSmokeTest()
    return
  }
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
  if (testMode.value !== 'query_balance' && testMode.value !== 'pay' && (!transferAmount.value || parseFloat(transferAmount.value) <= 0)) {
    showToast('请输入有效转账金额', 'error')
    return
  }
  if (testMode.value === 'pay' && (!payAmount.value || parseFloat(payAmount.value) <= 0)) {
    showToast('请输入有效支付金额', 'error')
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
  const payAmountInCents = Math.round(parseFloat(payAmount.value) * 100)
  const users = testUsers.value

  const workerPromises: Promise<void>[] = []
  const activeWorkers = new Set<number>()

  const runWorker = async (workerId: number) => {
    activeWorkers.add(workerId)
    while (!stopRequested.value && remainingTime.value > 0) {
      let result: TransferResult

      if (testMode.value === 'query_balance') {
        const user = users[Math.floor(Math.random() * users.length)]
        result = await doQueryBalance(user)
      } else if (testMode.value === 'pay') {
        const user = users[Math.floor(Math.random() * users.length)]
        result = await doPay(user, payAmountInCents)
      } else {
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

        result = await doTransfer(fromUser, toUserId, amountInCents, testVersion.value)
      }

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
        <p class="text-white/60 mt-2">C2C转账 / 余额查询 / 支付 / 全接口测试工具</p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div :class="testMode === 'smoke_test' ? 'lg:col-span-3 space-y-6' : 'lg:col-span-2 space-y-6'">
          <div v-if="testMode !== 'smoke_test'" class="card p-6 animate-slide-up">
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
                  <option value="query_balance">查询余额（并发查询余额接口）</option>
                  <option value="pay">支付（并发压测支付接口）</option>
                  <option value="smoke_test">全接口测试（串联所有接口冒烟测试）</option>
                </select>
              </div>
              <div v-if="testMode === 'smoke_test'" class="sm:col-span-2">
                <p class="text-sm text-gray-500 bg-blue-50 rounded-lg p-3">
                  全接口测试会自动创建买家/卖家用户，按依赖顺序串联执行所有接口（健康检查、注册、登录、充值、转账、提现、支付、查单等），并展示每个接口的执行结果。无需生成测试用户，点击「开始测试」即可。
                </p>
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
              <div v-if="testMode !== 'query_balance' && testMode !== 'pay'">
                <label class="label">转账金额（元）</label>
                <input
                  v-model="transferAmount"
                  type="text"
                  class="input-field"
                  placeholder="请输入转账金额"
                  :disabled="isRunning"
                />
              </div>
              <div v-if="testMode === 'pay'">
                <label class="label">支付金额（元）</label>
                <input
                  v-model="payAmount"
                  type="text"
                  class="input-field"
                  placeholder="请输入支付金额"
                  :disabled="isRunning"
                />
              </div>
              <div v-if="testMode === 'pay'">
                <label class="label">商户ID</label>
                <input
                  :value="PAY_MERCHANT_ID"
                  type="text"
                  class="input-field bg-gray-100"
                  disabled
                />
              </div>
              <div v-if="testMode !== 'query_balance' && testMode !== 'pay'">
                <label class="label">入账方式</label>
                <select v-model="testVersion" class="input-field" :disabled="isRunning">
                  <option :value="0">同步入账 (version=0)</option>
                  <option :value="1">异步入账 (version=1)</option>
                </select>
              </div>
              <div v-if="testMode !== 'smoke_test'">
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
                v-if="testMode === 'smoke_test'"
                @click="runTest"
                :disabled="smokeRunning"
                class="flex-1 btn-success py-3 text-lg flex items-center justify-center gap-2"
              >
                <RefreshCw v-if="smokeRunning" class="w-5 h-5 animate-spin" />
                <Play v-else class="w-5 h-5" />
                {{ smokeRunning ? '测试中...' : '开始测试' }}
              </button>
              <button
                v-else-if="!isRunning"
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

          <div v-if="testMode === 'smoke_test' && smokeSteps.length > 0" class="card p-6 animate-slide-up">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 class="w-5 h-5 text-primary-600" />
              接口执行情况
              <span class="text-sm font-normal text-gray-400 ml-auto">
                {{ smokeSteps.filter(s => s.status === 'success').length }}/{{ smokeSteps.length }} 通过
              </span>
            </h2>

            <div class="space-y-2">
              <div
                v-for="(step, idx) in smokeSteps"
                :key="idx"
                :class="[
                  'rounded-lg border overflow-hidden',
                  step.status === 'success' ? 'bg-green-50 border-green-100' :
                  step.status === 'fail' ? 'bg-red-50 border-red-100' :
                  step.status === 'running' ? 'bg-blue-50 border-blue-100' :
                  step.status === 'skip' ? 'bg-gray-50 border-gray-100' :
                  'bg-white border-gray-100'
                ]"
              >
                <div
                  class="flex items-center gap-3 py-2 px-3 cursor-pointer select-none hover:bg-black/5 transition-colors"
                  @click="step.expanded = !step.expanded"
                >
                  <ChevronRight
                    class="w-4 h-4 text-gray-400 shrink-0 transition-transform"
                    :class="step.expanded ? 'rotate-90' : ''"
                  />
                  <span class="text-xs text-gray-400 font-mono w-6 text-right">{{ idx + 1 }}</span>
                  <span
                    :class="[
                      'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0',
                      step.status === 'success' ? 'bg-green-500 text-white' :
                      step.status === 'fail' ? 'bg-red-500 text-white' :
                      step.status === 'running' ? 'bg-blue-500 text-white' :
                      step.status === 'skip' ? 'bg-gray-300 text-white' :
                      'bg-gray-200 text-gray-400'
                    ]"
                  >
                    <RefreshCw v-if="step.status === 'running'" class="w-3 h-3 animate-spin" />
                    <template v-else-if="step.status === 'success'">✓</template>
                    <template v-else-if="step.status === 'fail'">✕</template>
                    <template v-else-if="step.status === 'skip'">−</template>
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-800 truncate">{{ step.name }}</span>
                      <span class="text-xs text-gray-400 font-mono truncate">{{ step.api }}</span>
                    </div>
                    <div
                      v-if="step.message && step.status !== 'success'"
                      class="text-xs mt-0.5"
                      :class="step.status === 'fail' ? 'text-red-600' : 'text-gray-500'"
                    >
                      {{ step.message }}
                    </div>
                  </div>
                  <span
                    v-if="step.checks.length > 0"
                    :class="[
                      'text-xs font-medium px-1.5 py-0.5 rounded shrink-0',
                      step.checks.every(c => c.pass) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    ]"
                  >
                    校验 {{ step.checks.filter(c => c.pass).length }}/{{ step.checks.length }}
                  </span>
                  <span v-if="step.duration > 0" class="text-xs text-gray-400 font-mono shrink-0">{{ step.duration }}ms</span>
                </div>

                <div v-if="step.expanded" class="px-3 pb-3 pt-1 border-t border-black/5 space-y-2">
                  <div v-if="step.checks.length > 0">
                    <p class="text-xs font-semibold text-gray-500 mb-1">业务参数校验</p>
                    <div class="space-y-1">
                      <div
                        v-for="(chk, ci) in step.checks"
                        :key="ci"
                        :class="[
                          'flex items-start gap-2 text-xs rounded-md px-2 py-1.5',
                          chk.pass ? 'bg-green-50' : 'bg-red-50'
                        ]"
                      >
                        <span
                          :class="[
                            'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 mt-0.5',
                            chk.pass ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          ]"
                        >
                          <template v-if="chk.pass">✓</template>
                          <template v-else>✕</template>
                        </span>
                        <div class="flex-1 min-w-0">
                          <div :class="chk.pass ? 'text-green-700' : 'text-red-700'">{{ chk.label }}</div>
                          <div class="text-gray-500 font-mono break-all mt-0.5">
                            期望: {{ JSON.stringify(chk.expected) }} | 实际: {{ JSON.stringify(chk.actual) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-gray-500 mb-1">请求参数</p>
                    <pre class="text-xs bg-gray-800 text-green-300 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ step.request ? JSON.stringify(step.request, null, 2) : '（无）' }}</pre>
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-gray-500 mb-1">返回参数</p>
                    <pre class="text-xs bg-gray-800 text-blue-200 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ step.response !== null ? JSON.stringify(step.response, null, 2) : '（未执行）' }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="testMode !== 'smoke_test'" class="space-y-6">
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
