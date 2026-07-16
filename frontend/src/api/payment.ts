import apiClient from './client';

export interface PaymentCreateRequest {
  transaction_id: string;
  payment_method: 'qris' | 'virtual_account' | 'ewallet' | 'cash';
  payment_channel?: string;
}

export interface PaymentData {
  payment_id: string;
  order_id: string;
  amount: number;
  method: string;
  channel?: string;
  expired_at: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  use_midtrans: boolean;
  mode?: string;
  notice?: string;
  qr_string?: string;
  qr_image_url?: string;
  payment_instructions?: string;
  va_number?: string;
  bank?: string;
  deeplink?: string;
  simulator_url?: string;
  midtrans_transaction_id?: string;
}

export const createPayment = async (req: PaymentCreateRequest): Promise<PaymentData> => {
  const resp = await apiClient.post('/payment/create', req);
  return resp.data.data as PaymentData;
};

export const checkPaymentStatus = async (orderID: string): Promise<{
  order_id: string;
  status: string;
  midtrans_status?: string;
  mode?: string;
}> => {
  const resp = await apiClient.get(`/payment/status/${orderID}`);
  return resp.data.data;
};

export const simulatePayment = async (orderID: string): Promise<{
  payment_id: string;
  order_id: string;
  status: string;
  paid_at: string;
  mqtt_topic: string;
}> => {
  const resp = await apiClient.post(`/payment/simulate/${orderID}`);
  return resp.data.data;
};
