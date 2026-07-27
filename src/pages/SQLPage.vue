<script setup lang="ts">
import { ref } from 'vue'
import { Database, Copy, RefreshCw } from 'lucide-vue-next'

interface TableConfig {
  name: string
  primaryKey: string
  primaryKeyType: 'numeric' | 'string'
  database: string
  description: string
}

const tables: TableConfig[] = [
  { name: 't_c_account', primaryKey: 'uid', primaryKeyType: 'numeric', database: 'account_db', description: 'C账户表(用户)' },
  { name: 't_c_account_log', primaryKey: 'id', primaryKeyType: 'numeric', database: 'account_db', description: '用户流水日志表' },
  { name: 't_b_account', primaryKey: 'uid', primaryKeyType: 'numeric', database: 'account_db', description: 'B账户表(商户)' },
  { name: 't_c2c_bill', primaryKey: 'transaction_id', primaryKeyType: 'string', database: 'account_db', description: 'C2C单据表' },
  { name: 't_save_bill', primaryKey: 'transaction_id', primaryKeyType: 'string', database: 'account_db', description: '充值订单表' },
  { name: 't_pending_c2c_transfer', primaryKey: 'transaction_id', primaryKeyType: 'string', database: 'account_db', description: '待处理C2C转账表' },
  { name: 't_relation', primaryKey: 'user_id', primaryKeyType: 'string', database: 'user_db', description: '用户关联表' },
  { name: 't_user_info', primaryKey: 'uid', primaryKeyType: 'numeric', database: 'user_db', description: '用户信息表' },
]

const inputValue = ref('')
const outputSql = ref('')
const copied = ref(false)

const generateSql = (table: TableConfig) => {
  const value = inputValue.value.trim()
  if (!value) {
    outputSql.value = '-- 请先输入主键值'
    return
  }
  
  let formattedValue: string
  if (table.primaryKeyType === 'numeric') {
    formattedValue = value
  } else {
    formattedValue = `"${value}"`
  }
  
  outputSql.value = `select * from ${table.database}.${table.name} where ${table.primaryKey}=${formattedValue} limit 2\\G`
}

const copySql = async () => {
  if (!outputSql.value) return
  try {
    await navigator.clipboard.writeText(outputSql.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

const clearAll = () => {
  inputValue.value = ''
  outputSql.value = ''
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-6">
    <div class="max-w-4xl mx-auto">
      <header class="text-center mb-8 animate-fade-in">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4">
          <Database class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white">SQL生成器</h1>
        <p class="text-white/60 mt-2">快速生成数据库查询语句</p>
      </header>

      <div class="card p-6 animate-slide-up">
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="label block mb-2">主键值</label>
            <input
              v-model="inputValue"
              type="text"
              class="input-field w-full text-lg"
              placeholder="请输入表的主键值，例如: 111"
            />
          </div>

          <div>
            <label class="label block mb-2">选择表</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
              <button
                v-for="table in tables"
                :key="table.name"
                @click="generateSql(table)"
                class="p-3 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div class="font-medium text-gray-800 text-sm">{{ table.name }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ table.description }}</div>
              </button>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="label">生成的SQL</label>
              <div class="flex gap-2">
                <button
                  @click="copySql"
                  :disabled="!outputSql"
                  class="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy class="w-4 h-4" />
                  {{ copied ? '已复制' : '复制' }}
                </button>
                <button
                  @click="clearAll"
                  class="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RefreshCw class="w-4 h-4" />
                  清空
                </button>
              </div>
            </div>
            <textarea
              v-model="outputSql"
              class="w-full h-32 p-4 border border-gray-200 rounded-lg font-mono text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="点击上方按钮生成SQL语句..."
            ></textarea>
          </div>
        </div>
      </div>

      <div class="card p-6 mt-6 animate-slide-up" style="animation-delay: 0.1s">
        <h3 class="font-semibold text-gray-800 mb-4">表结构说明</h3>
        <div class="space-y-4">
          <div
            v-for="table in tables"
            :key="table.name"
            class="bg-gray-50 rounded-lg p-4"
          >
            <div class="font-mono font-medium text-gray-800">{{ table.name }}</div>
            <div class="text-sm text-gray-500 mt-1">{{ table.description }}</div>
            <div class="text-xs text-blue-600 mt-2">主键: {{ table.primaryKey }} ({{ table.primaryKeyType === 'numeric' ? 'BIGINT' : 'VARCHAR' }})</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
