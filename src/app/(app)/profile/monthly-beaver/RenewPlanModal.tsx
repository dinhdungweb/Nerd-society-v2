'use client';

import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CreditCardIcon,
  QrCodeIcon,
  WalletIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolidIcon } from '@heroicons/react/24/solid';
import { createRenewalOrder, payRegistrationOrderWithWallet } from '@/actions/subscription-actions';
import toast from 'react-hot-toast';

type PlanType = 'WEEKLY_LIMITED' | 'MONTHLY_LIMITED' | 'MONTHLY_UNLIMITED';

interface RenewPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberId: string;
  currentPlanType?: string;
  walletBalance?: number;
  walletStatus?: string;
}

const PLANS = [
  {
    type: 'MONTHLY_LIMITED' as PlanType,
    name: 'Gói Tháng Limited',
    price: '549.000đ',
    priceNum: 549000,
  },
];

export default function RenewPlanModal({
  isOpen,
  onClose,
  subscriberId,
  currentPlanType,
  walletBalance = 0,
  walletStatus = 'ACTIVE',
}: RenewPlanModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select Plan, 2: Payment, 3: Success
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>(
    (currentPlanType as PlanType) || 'MONTHLY_LIMITED'
  );
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState<{ id: string; orderCode: string } | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<{ bankCode: string; accountNumber: string; accountName: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError('');
      setOrderResult(null);
      setQrUrl('');
      setBankInfo(null);
      setSelectedPlanType((currentPlanType as PlanType) || 'MONTHLY_LIMITED');
    }
  }, [isOpen, currentPlanType]);

  // Polling check payment status cho VietQR
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 2 && paymentMethod === 'online_transfer' && orderResult?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/subscriptions/orders?id=${orderResult.id}`);
          if (res.ok) {
            const data = await res.json();
            const order = Array.isArray(data) ? data[0] : data;
            if (order?.orderStatus === 'PAID') {
              setStep(3);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [step, orderResult, paymentMethod]);

  if (!isOpen) return null;

  const selectedPlan = PLANS.find((p) => p.type === selectedPlanType) || PLANS[0];
  const walletCanPay = walletStatus === 'ACTIVE' && walletBalance >= selectedPlan.priceNum;
  const walletBalanceAfter = walletBalance - selectedPlan.priceNum;

  const handleCreateOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createRenewalOrder({
        subscriberId,
        planType: selectedPlanType,
        paymentMethod: paymentMethod === 'wallet' ? 'wallet' : 'online',
      });

      if (result.success && result.order) {
        setOrderResult({ id: result.order.id, orderCode: result.order.orderCode });
        if (result.qrUrl) setQrUrl(result.qrUrl);
        if (result.bankInfo) setBankInfo(result.bankInfo);
        
        if (paymentMethod === 'wallet') {
          // Thực hiện thanh toán ví luôn
          const payResult = await payRegistrationOrderWithWallet(result.order.id);
          if (payResult.success) {
            toast.success('Gia hạn bằng Ví Nerd thành công!');
            setStep(3);
          } else {
            setError(payResult.error || 'Thanh toán bằng Ví Nerd thất bại.');
            // Nếu lỗi ví, lùi về bước 2 để chọn cách khác hoặc thử lại (mặc dù đã tạo order)
            setStep(2);
          }
        } else {
          // VietQR: chuyển sang bước 2 để hiển thị QR
          setStep(2);
        }
      } else {
        setError(result.error || 'Có lỗi xảy ra khi tạo đơn.');
      }
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletRetry = async () => {
    if (!orderResult?.id) return;
    setLoading(true);
    setError('');
    try {
      const payResult = await payRegistrationOrderWithWallet(orderResult.id);
      if (payResult.success) {
        toast.success('Gia hạn bằng Ví Nerd thành công!');
        setStep(3);
      } else {
        setError(payResult.error || 'Thanh toán bằng Ví Nerd thất bại.');
      }
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-100">
          <h2 className="text-xl font-bold text-neutral-900">Gia hạn gói cước</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Chọn gói gia hạn</label>
                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <label
                      key={plan.type}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                        selectedPlanType === plan.type
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                          : 'border-neutral-200 hover:border-primary-300'
                      }`}
                      onClick={() => setSelectedPlanType(plan.type)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedPlanType === plan.type ? 'border-primary-500' : 'border-neutral-300'}`}>
                          {selectedPlanType === plan.type && <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                        </div>
                        <div className="font-semibold text-neutral-900">{plan.name}</div>
                      </div>
                      <div className="font-bold text-primary-700">{plan.price}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Phương thức thanh toán</label>
                <div className="space-y-3">
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    onClick={() => setPaymentMethod('wallet')}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'wallet' ? 'border-primary-500' : 'border-neutral-300'}`}>
                      {paymentMethod === 'wallet' && <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <WalletIcon className="h-5 w-5 text-neutral-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-neutral-900">Ví Nerd</p>
                      <p className="text-xs text-neutral-500">Số dư: {walletBalance.toLocaleString()}đ</p>
                    </div>
                  </label>

                  {paymentMethod === 'wallet' && (
                    <div className="pl-12 pr-4 pb-2">
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-neutral-500">
                          <span>Sau thanh toán:</span>
                          <span className={walletCanPay ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {walletBalanceAfter.toLocaleString()}đ
                          </span>
                        </div>
                        {!walletCanPay && (
                          <p className="text-red-600 mt-1">Số dư không đủ. Vui lòng nạp thêm hoặc chọn phương thức khác.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all ${
                      paymentMethod === 'online_transfer'
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    onClick={() => setPaymentMethod('online_transfer')}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online_transfer' ? 'border-primary-500' : 'border-neutral-300'}`}>
                      {paymentMethod === 'online_transfer' && <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <QrCodeIcon className="h-5 w-5 text-neutral-500" />
                    <div>
                      <p className="font-medium text-neutral-900">Chuyển khoản (VietQR)</p>
                      <p className="text-xs text-neutral-500">Tự động xác nhận</p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={loading || (paymentMethod === 'wallet' && !walletCanPay)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-600 disabled:opacity-50"
              >
                {loading ? (
                  <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Đang xử lý...</>
                ) : (
                  <>Tiếp tục <ArrowRightIcon className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
                <span>Đơn gia hạn:</span>
                <span className="font-bold">{orderResult?.orderCode}</span>
              </div>

              {paymentMethod === 'online_transfer' ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="relative mx-auto mb-3 flex aspect-square w-full max-w-[240px] items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    {qrUrl ? (
                      <img src={qrUrl} alt="VietQR" className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-neutral-400">
                        <ArrowPathIcon className="h-8 w-8 animate-spin" />
                        <span className="text-xs">Đang tạo mã QR...</span>
                      </div>
                    )}
                  </div>
                  
                  {bankInfo && (
                    <div className="space-y-2 text-left bg-white p-3 rounded-xl border border-neutral-200 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Số tiền:</span>
                        <span className="font-bold text-primary-700">{selectedPlan.price}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Nội dung:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{orderResult?.orderCode}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(orderResult?.orderCode || '');
                              toast.success('Đã copy nội dung');
                            }}
                            className="p-1 hover:bg-neutral-100 rounded"
                          >
                            <ClipboardDocumentListIcon className="h-4 w-4 text-neutral-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-xs font-medium">Đang chờ thanh toán...</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">Hệ thống sẽ tự động chuyển trang khi nhận được tiền.</p>
                  </div>
                </div>
              ) : (
                <div className="py-8">
                  {/* Trường hợp lỗi ví, hiện nút thử lại */}
                  <p className="mb-4 text-neutral-600">Thanh toán ví chưa hoàn tất. Bạn có muốn thử lại không?</p>
                  <button
                    onClick={handleWalletRetry}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {loading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : 'Thử lại bằng Ví Nerd'}
                  </button>
                  <button
                    onClick={() => {
                      setStep(1);
                      setOrderResult(null); // Quay lại bước 1
                    }}
                    className="w-full mt-3 text-sm font-medium text-neutral-500 hover:text-neutral-800"
                  >
                    Chọn phương thức khác
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-200">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">Gia hạn thành công!</h3>
              <p className="text-neutral-500 mb-6">
                Gói {selectedPlan.name} của bạn đã được gia hạn và sẵn sàng sử dụng.
              </p>
              <button
                onClick={() => {
                  onClose();
                  window.location.reload(); // Reload để cập nhật data mới
                }}
                className="w-full rounded-full bg-primary-500 py-3.5 font-semibold text-white shadow-lg hover:bg-primary-600 transition-all"
              >
                Đóng và tải lại trang
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
