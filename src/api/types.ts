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
  business_info: string
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
  desc: string
  verify_type: number
  password: string
}

export interface Bank2CDoRsp {
  transaction_id: string
  user_id: string
  is_repeat: number
}