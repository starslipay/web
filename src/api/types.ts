export interface HealthReq { }
export interface HealthRsp { }

export interface UpdateUserInfoReq {
  user_id?: string
  name?: string
  gender?: number
  age?: number
  address?: string
  phone?: string
  email?: string
  id_type?: number
  id_card?: string
}

export interface UpdateUserInfoRsp {
  user_id: string
}

export interface RegUserReq {
  user_id?: string
  password?: string
  name?: string
  gender?: number
  age?: number
  address?: string
  phone?: string
  email?: string
  id_type?: number
  id_card?: string
}

export interface RegUserRsp {
  user_id: string
}

export interface CancelUserReq {
  user_id?: string // 用户ID
}

export interface CancelUserRsp {
  user_id: string // 用户ID
}

export interface GetUserInfoReq {
  user_id?: string
}

export interface GetUserInfoRsp {
  user_id: string
  name: string
  gender: number
  age: number
  address: string
  phone: string
  email: string
  id_type: number
  id_card: string
}

export interface GetUserBalanceInfoReq {
  user_id?: string
}

export interface GetUserBalanceInfoRsp {
  user_id: string
  balance: number
  cur_type: number
}

export interface GetUserTokenReq {
  user_id: string
  password: string
  business_info?: string
}

export interface GetUserTokenRsp {
  user_id: string
  user_token: string
}

export interface GetUserFlowReq {
  user_id?: string
  offset?: number
  limit?: number
}

export interface UserFlow {
  transaction_id: string
  user_id: string
  counterparty_user_id: string
  inout_type: number
  biz_type: number
  amount: number
  balance: number
  desc: string
  memo: string
  create_time: string
}

export interface GetUserFlowRsp {
  user_id: string
  next_offset: number
  end_flag: number
  UserFlowList: UserFlow[]
}

export interface C2CTransferPreReq {
  buyer_user_id: string
}

export interface C2CTransferPreRsp {
  buyer_user_id: string
  transaction_id: string
}

export interface C2CTransferDoReq {
  transaction_id: string
  buyer_user_id: string
  seller_user_id: string
  amount: number
  verify_type: number
  password: string
  version: number
  memo?: string
}

export interface C2CTransferDoRsp {
  transaction_id: string
  buyer_user_id: string
  seller_user_id: string
  is_repeat: number
}

export interface Bank2CPreReq {
  user_id: string
}

export interface Bank2CPreRsp {
  user_id: string
  transaction_id: string
}

export interface Bank2CDoReq {
  transaction_id: string
  user_id: string
  bank_type: number
  amount: number
  memo: string
  verify_type: number
  password: string
}

export interface Bank2CDoRsp {
  transaction_id: string
  user_id: string
  is_repeat: number
}

export interface C2BankPreReq {
  user_id: string
}

export interface C2BankPreRsp {
  user_id: string
  transaction_id: string
}

export interface C2BankDoReq {
  transaction_id: string
  user_id: string
  bank_type: number
  amount: number
  memo: string
  verify_type: number
  password: string
}

export interface C2BankDoRsp {
  transaction_id: string
  user_id: string
  is_repeat: number
}

export interface GetC2CBillReq {
  transaction_id: string
}

export interface GetC2CBillRsp {
  transaction_id: string
  buyer_user_id: string
  seller_user_id: string
  pay_time: string
  amount: number
  desc: string
  memo: string
}

// ============ 商城支付相关接口 ============

export interface PayPreReq {
  user_id?: string
  merchant_id?: string
}

export interface PayPreRsp {
  user_id: string
  transaction_id: string
}

export interface BanPayReq {
  transaction_id?: string
  out_order_no?: string
  merchant_id?: string
  user_id?: string
  amount?: number
  verify_type?: number
  password?: string
  memo?: string
  mock_flag?: number // 测试用断点控制: 0=正常, 1=下单前中断, 2=C2B扣款前中断, 3=订单更新前中断, 4=订单更新后中断
}

export interface BanPayRsp {
  transaction_id: string
  user_id: string
  order_success_token: string
}

export interface GetOrderInfoReq {
  transaction_id: string
}

export interface GetOrderInfoRsp {
  transaction_id: string
  out_order_no: string
  merchant_id: string
  merchant_name: string
  user_id: string
  amount: number
  pay_time: string
  trade_state: number
}

export interface QueryOrderReq {
  transaction_id: string
}

export interface QueryOrderRsp {
  transaction_id: string
  out_order_no: string
  merchant_id: string
  merchant_uid: number
  merchant_name: string
  user_id: string
  uid: number
  amount: number
  pay_time: string
  trade_state: number
  order_success_token: string
}

export interface QueryC2BBillReq {
  transaction_id: string
}

export interface QueryC2BBillRsp {
  transaction_id: string
  out_trade_no: string
  uid: number
  user_id: string
  merchant_uid: number
  merchant_id: string
  amount: number
  state: number
  pay_time: string
  deduct_token: string
}

export interface CloseOrSupplyOrderReq {
  transaction_id?: string
  out_order_no?: string
  merchant_id?: string
  user_id?: string
  amount?: number
}

export interface CloseOrSupplyOrderRsp {
  result_code: number
  transaction_id: string
  out_order_no: string
  merchant_id: string
  user_id: string
  amount: number
  pay_time: string
  order_success_token: string
}