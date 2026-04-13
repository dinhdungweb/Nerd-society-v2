'use client';

/**
 * Trang Nerd Pass — Đăng ký gói thành viên (Public)
 * Flow: Chọn gói → Điền info + Selfie → Thanh toán → Xác nhận
 * Phong cách: Đồng bộ với website (Light, Warm Beige Tones)
 */

import React, { useState } from 'react';
import {
  BoltIcon,
  CheckIcon,
  CameraIcon,
  ArrowLeftIcon,
  HomeIcon,
  PhotoIcon,
  ClockIcon,
  MapPinIcon,
  ArrowRightIcon,
  CreditCardIcon,
  BuildingStorefrontIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  QrCodeIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  CheckIcon as CheckSolidIcon,
  SparklesIcon as SparklesSolidIcon,
} from '@heroicons/react/24/solid';
import { createRegistrationOrder } from '@/actions/subscription-actions';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';


// ======================== TYPES ========================

type PlanType = 'WEEKLY_LIMITED' | 'MONTHLY_LIMITED' | 'MONTHLY_UNLIMITED';

interface PlanInfo {
  type: PlanType;
  name: string;
  price: string;
  priceNum: number;
  duration: string;
  hours: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

const PLANS: PlanInfo[] = [
  {
    type: 'MONTHLY_LIMITED',
    name: 'Gói Tháng Limited',
    price: '549.000đ',
    priceNum: 549000,
    duration: '30 ngày',
    hours: '50 giờ',
    popular: true,
    icon: <SparklesSolidIcon className="h-5 w-5 text-primary-600" />,
    features: [
      'Fast check-in (quẹt thẻ)',
      'Laptop stand',
      'Locker cố định',
      'Giảm 15% đồ uống',
      '1 ly free/tuần',
      'Carry-over tối đa 10h',
      'Dùng cả 2 cơ sở',
    ],
  },
];

// ======================== MAIN COMPONENT ========================

export default function NerdPassPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    branchPrimary: 'HTM',
  });
  const { data: session, status } = useSession();

  // Pre-fill form when session is available
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || session.user.name || '',
        email: prev.email || session.user.email || '',
        phone: prev.phone || (session.user as any).phone || '',
      }));
    }
  }, [session, status]);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('online_transfer');
  const [orderResult, setOrderResult] = useState<{ id: string; orderCode: string } | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<{ bankCode: string; accountNumber: string; accountName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Polling check payment status
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 3 && orderResult?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/subscriptions/orders?id=${orderResult.id}`);
          if (res.ok) {
            const data = await res.json();
            const order = Array.isArray(data) ? data[0] : data;
            if (order?.orderStatus === 'PAID') {
              setStep(4);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000); // Check every 5s
    }
    return () => clearInterval(interval);
  }, [step, orderResult]);

  // Function to create order when moving to payment step
  const handleProceedToPayment = async () => {
    setLoading(true);
    setError('');
    try {
      let uploadedSelfieUrl = '/placeholder-selfie.jpg';
      if (selfieBlob) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', selfieBlob, 'selfie.jpg');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedSelfieUrl = uploadData.url || uploadedSelfieUrl;
        }
      }

      const result = await createRegistrationOrder({
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email || undefined,
        branchPrimary: formData.branchPrimary,
        planType: selectedPlan!.type,
        selfieUrl: uploadedSelfieUrl,
        paymentMethod: 'online', // Mặc định tạo đơn online để lấy QR
        userId: session?.user?.id,
      });

      if (result.success && result.order) {
        setOrderResult({ id: result.order.id, orderCode: result.order.orderCode });
        if (result.qrUrl) setQrUrl(result.qrUrl);
        if (result.bankInfo) setBankInfo(result.bankInfo);
        setStep(3);
      } else {
        setError(result.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  // ======================== LOADING / AUTH CHECK ========================
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50"><ArrowPathIcon className="h-8 w-8 animate-spin text-primary-500" /></div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-24 text-center">
        <div className="mb-6 rounded-3xl bg-white p-8 shadow-sm border border-neutral-200 max-w-md">
           <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
             <ExclamationCircleIcon className="h-8 w-8 text-amber-500" />
           </div>
           <h2 className="mb-3 text-2xl font-bold text-neutral-900">Yêu cầu đăng nhập</h2>
           <p className="mb-6 text-neutral-500">Để đăng ký Nerd Pass và quản lý quyền lợi hội viên, bạn cần có tài khoản Nerd Society trước.</p>
           <div className="flex flex-col gap-3">
             <a href="/login?callbackUrl=/nerd-pass" className="w-full rounded-full bg-primary-500 py-3 font-semibold text-white shadow-lg hover:bg-primary-600 transition-all">Đăng nhập ngay</a>
             <a href="/signup?callbackUrl=/nerd-pass" className="w-full rounded-full border border-neutral-300 py-3 font-semibold text-neutral-700 hover:bg-neutral-50 transition-all">Đăng ký tài khoản mới</a>
           </div>
        </div>
      </div>
    );
  }

  // ======================== STEP 1: CHỌN GÓI ========================
  if (step === 1) {
    return (
      <div className="bg-neutral-50 pt-24 pb-16 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-14 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-100 px-5 py-2 text-sm font-medium text-primary-700">
              <SparklesSolidIcon className="h-4 w-4" />
              NERD PASS
            </span>
            <h1 className="mt-5 text-4xl font-bold text-neutral-900 md:text-5xl">
              Gói Thành Viên
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500">
              Đăng ký Nerd Pass để check-in nhanh bằng thẻ, hưởng ưu đãi đặc biệt tại không gian Nerd Society.
            </p>
          </div>

          {/* Plans Grid */}
          <div className="flex justify-center">
            <div className="w-full max-w-sm">
              {PLANS.map((plan) => (
              <div
                key={plan.type}
                className={`group relative overflow-hidden rounded-3xl border bg-white transition-all duration-300 hover:shadow-lg ${
                  plan.popular
                    ? 'border-primary-400 shadow-md shadow-primary-500/10'
                    : 'border-neutral-200 hover:border-primary-300'
                }`}
              >
                {plan.popular && (
                  <div className="flex items-center justify-center gap-1.5 bg-primary-500 py-2 text-center text-xs font-semibold tracking-wider text-white uppercase">
                    <SparklesSolidIcon className="h-3.5 w-3.5" />
                    Phổ biến nhất
                  </div>
                )}

                <div className="p-7">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100">
                      {plan.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">{plan.name}</h3>
                      <p className="text-sm text-neutral-400">{plan.hours} · {plan.duration}</p>
                    </div>
                  </div>

                  <div className="mb-6 mt-5">
                    <span className="text-3xl font-bold text-neutral-900">{plan.price}</span>
                  </div>

                  <ul className="mb-7 space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-600">
                        <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => {
                      setSelectedPlan(plan);
                      setStep(2);
                    }}
                    className={`w-full rounded-full py-3.5 text-sm font-semibold transition-all duration-200 ${
                      plan.popular
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600'
                        : 'border border-neutral-300 bg-white text-neutral-800 hover:border-primary-400 hover:bg-primary-50'
                    }`}
                  >
                    Chọn gói này
                  </button>
                </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-primary-200/60 bg-primary-50 p-5">
            <LightBulbIcon className="h-5 w-5 flex-shrink-0 text-primary-600 mt-0.5" />
            <p className="text-sm text-neutral-600">
              Gói bắt đầu tính từ <strong className="text-neutral-900">lần đầu bạn đến quán</strong>, không phải từ lúc mua — yên tâm đăng ký trước!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ======================== STEP 2: THÔNG TIN + SELFIE ========================
  if (step === 2 && selectedPlan) {
    return (
      <div className="bg-neutral-50 pt-24 pb-12 px-4">
        <div className="mx-auto max-w-lg">
          <button onClick={() => setStep(1)} className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Quay lại chọn gói
          </button>

          <div className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-1.5 text-xs font-semibold text-primary-700">
                {selectedPlan.icon}
                {selectedPlan.name} — {selectedPlan.price}
              </span>
              <h2 className="mt-4 text-2xl font-bold text-neutral-900">Thông tin đăng ký</h2>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Họ tên *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none transition-all"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Số điện thoại *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none transition-all"
                  placeholder="0987654321"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none transition-all"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Cơ sở chính *</label>
                <div className="flex gap-3">
                  {[
                    { value: 'HTM', label: 'Hồ Tùng Mậu' },
                    { value: 'TS', label: 'Tây Sơn' },
                  ].map((b) => (
                    <button
                      key={b.value}
                      onClick={() => setFormData({ ...formData, branchPrimary: b.value })}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition-all ${
                        formData.branchPrimary === b.value
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                      }`}
                    >
                      <MapPinIcon className="h-4 w-4" />
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-neutral-400">Bạn có thể dùng cả 2 cơ sở</p>
              </div>

              {/* Selfie */}
              <div className="mt-6 border-t border-neutral-100 pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <CameraIcon className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-neutral-900">Xác thực khuôn mặt</h3>
                </div>
                <p className="mb-4 text-sm text-neutral-500">
                  Ảnh này dùng để nhân viên xác nhận khi bạn check-in. Chỉ NV Nerd Society thấy.
                </p>

                {selfieUrl ? (
                  <div className="text-center">
                    <img
                      src={selfieUrl}
                      alt="Selfie"
                      className="mx-auto h-48 w-48 rounded-2xl object-cover border-2 border-primary-300 shadow-sm"
                    />
                    <button
                      onClick={() => { setSelfieUrl(null); setSelfieBlob(null); }}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Chụp lại
                    </button>
                  </div>
                ) : (
                  <SelfieCapture
                    onCapture={(url, blob) => {
                      setSelfieUrl(url);
                      setSelfieBlob(blob);
                    }}
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleProceedToPayment}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  Tiếp tục
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ======================== STEP 3: THANH TOÁN ========================
  if (step === 3 && selectedPlan) {
    const orderCodePreview = `NP-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-XXX`;

    return (
      <div className="bg-neutral-50 pt-24 pb-12 px-4">
        <div className="mx-auto max-w-lg">
          <button onClick={() => setStep(2)} className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Quay lại
          </button>

          <div className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCardIcon className="h-6 w-6 text-primary-600" />
              <h2 className="text-2xl font-bold text-neutral-900">Thanh toán</h2>
            </div>

            {/* Order summary */}
            <div className="mb-6 flex items-center justify-between rounded-2xl bg-primary-50 border border-primary-200/50 p-4">
              <div>
                <p className="text-sm text-neutral-500">Gói đã chọn</p>
                <p className="font-semibold text-neutral-900">{selectedPlan.name}</p>
              </div>
              <span className="text-xl font-bold text-primary-700">{selectedPlan.price}</span>
            </div>

            {/* Payment methods */}
            <div className="space-y-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
                  paymentMethod === 'online_transfer'
                    ? 'border-primary-400 bg-primary-50/50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
                onClick={() => setPaymentMethod('online_transfer')}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online_transfer' ? 'border-primary-500' : 'border-neutral-300'}`}>
                  {paymentMethod === 'online_transfer' && <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                </div>
                <QrCodeIcon className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="font-medium text-neutral-900">Chuyển khoản ngay (VietQR)</p>
                  <p className="text-xs text-neutral-400">Quét mã QR để thanh toán</p>
                </div>
              </label>

              {paymentMethod === 'online_transfer' && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-center">
                  <div className="mx-auto mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm relative group">
                    {qrUrl ? (
                      <img 
                        src={qrUrl}
                        alt="VietQR Payment"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-neutral-400">
                        <ArrowPathIcon className="h-8 w-8 animate-spin" />
                        <span className="text-xs">Đang tạo mã QR...</span>
                      </div>
                    )}
                  </div>

                  {bankInfo && (
                    <div className="mt-4 space-y-2 text-left bg-white rounded-2xl border border-neutral-200 p-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Ngân hàng:</span>
                        <span className="font-semibold text-neutral-900">{bankInfo.bankCode}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Số tài khoản:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary-700">{bankInfo.accountNumber}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(bankInfo.accountNumber);
                              toast.success('Đã sao chép số tài khoản');
                            }}
                            className="p-1 hover:bg-neutral-100 rounded"
                          >
                            <ClipboardDocumentListIcon className="h-4 w-4 text-neutral-400" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Chủ tài khoản:</span>
                        <span className="font-medium text-neutral-900 uppercase">{bankInfo.accountName}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Nội dung CK:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary-700">{orderResult?.orderCode}</span>
                          <button 
                             onClick={() => {
                              navigator.clipboard.writeText(orderResult?.orderCode || '');
                              toast.success('Đã sao chép nội dung');
                            }}
                            className="p-1 hover:bg-neutral-100 rounded"
                          >
                            <ClipboardDocumentListIcon className="h-4 w-4 text-neutral-400" />
                          </button>
                        </div>
                      </div>

                    </div>
                  )}


                </div>
              )}

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
                  paymentMethod === 'at_counter'
                    ? 'border-primary-400 bg-primary-50/50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
                onClick={() => setPaymentMethod('at_counter')}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'at_counter' ? 'border-primary-500' : 'border-neutral-300'}`}>
                  {paymentMethod === 'at_counter' && <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                </div>
                <BuildingStorefrontIcon className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="font-medium text-neutral-900">Thanh toán tại quầy</p>
                  <p className="text-xs text-neutral-400">Đơn sẽ được giữ 7 ngày</p>
                </div>
              </label>
            </div>

              {paymentMethod === 'at_counter' ? (
                <button 
                  onClick={() => setStep(4)}
                  className="mt-8 w-full rounded-full bg-neutral-900 py-4 font-bold text-white shadow-xl hover:bg-neutral-800 transition-all active:scale-[0.98]"
                >
                  Hoàn tất đặt đơn
                </button>
              ) : (
                <>
                  <div className="mt-8 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                      <span className="text-sm font-medium text-primary-700 italic">Hệ thống đang chờ lệnh chuyển tiền...</span>
                    </div>
                    
                    <p className="text-[11px] text-neutral-400 text-center max-w-[280px]">
                      Trang sẽ tự động chuyển sang bước xác nhận ngay sau khi giao dịch thành công. Đừng đóng trình duyệt nhé!
                    </p>
                  </div>
                </>
              )}

          </div>
        </div>
      </div>
    );
  }

  // ======================== STEP 4: XÁC NHẬN ========================
  if (step === 4 && selectedPlan && orderResult) {
    const branchName = formData.branchPrimary === 'HTM' ? 'Hồ Tùng Mậu' : 'Tây Sơn';

    return (
      <div className="bg-neutral-50 pt-24 pb-12 px-4">
        <div className="mx-auto max-w-lg">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>

            <h2 className="mb-2 text-2xl font-bold text-neutral-900">Đăng ký thành công!</h2>
            <p className="mb-6 text-neutral-500">Mã đơn: <span className="font-mono font-semibold text-primary-700">{orderResult.orderCode}</span></p>

            <div className="mb-6 rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Gói</span>
                  <span className="font-medium text-neutral-900">{selectedPlan.name} ({selectedPlan.price})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Cơ sở</span>
                  <span className="font-medium text-neutral-900">{branchName}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary-200/60 bg-primary-50 p-5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardDocumentListIcon className="h-4 w-4 text-primary-700" />
                <h3 className="text-sm font-semibold text-primary-700">Bước tiếp theo</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-neutral-600">
                <li className="flex items-start gap-2">
                  <MapPinIcon className="h-4 w-4 flex-shrink-0 text-primary-500 mt-0.5" />
                  Ghé cơ sở <strong className="text-neutral-900">{branchName}</strong> để nhận thẻ Nerd Pass
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="h-4 w-4 flex-shrink-0 text-primary-500 mt-0.5" />
                  Thẻ đã được chuẩn bị sẵn mang tên bạn
                </li>
                <li className="flex items-start gap-2">
                  <BoltIcon className="h-4 w-4 flex-shrink-0 text-primary-500 mt-0.5" />
                  Lần đầu tap thẻ vào máy = gói bắt đầu tính
                </li>
              </ul>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-neutral-400">
                <ClockIcon className="h-3.5 w-3.5" />
                Hạn nhận thẻ: 30 ngày kể từ hôm nay
              </div>
            </div>

            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-8 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 hover:border-primary-400"
            >
              <HomeIcon className="h-4 w-4" />
              Về trang chủ
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ======================== SELFIE CAPTURE COMPONENT ========================

function SelfieCapture({ onCapture }: { onCapture: (url: string, blob: Blob) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const startCamera = async () => {
    setCameraError('');
    
    // Kiểm tra Secure Context (Camera yêu cầu HTTPS hoặc localhost)
    if (!window.isSecureContext) {
      setCameraError('Trình duyệt yêu cầu kết nối bảo mật (HTTPS) để truy cập camera. Vui lòng kiểm tra lại URL.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 500 }, 
          height: { ideal: 500 }, 
          facingMode: 'user' 
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err: any) {
      console.error('Camera Error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Bạn đã chặn quyền truy cập camera. Vui lòng bấm vào biểu tượng ổ khóa trên thanh địa chỉ để cấp quyền lại.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Không tìm thấy thiết bị camera trên máy của bạn.');
      } else {
        setCameraError('Lỗi: ' + (err.message || 'Không thể truy cập camera. Vui lòng thử lại.'));
      }
    }
  };

  const capture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 500, 500);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onCapture(url, blob);

        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach((t) => t.stop());
        setStreaming(false);
      }
    }, 'image/jpeg', 0.85);
  };

  return (
    <div className="text-center">
      {cameraError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-600 mb-4">{cameraError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Thử lại camera
            </button>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-full border border-neutral-300 bg-white px-6 py-2.5 text-sm text-neutral-600 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <PhotoIcon className="h-4 w-4" />
              Chọn ảnh
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    onCapture(url, file);
                  }
                }}
              />
            </label>
          </div>
        </div>
      ) : !streaming ? (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={startCamera}
            className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 transition-colors"
          >
            <CameraIcon className="h-4 w-4" />
            Mở camera
          </button>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-full border border-neutral-300 bg-white px-6 py-2.5 text-sm text-neutral-600 hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <PhotoIcon className="h-4 w-4" />
            Chọn ảnh
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  onCapture(url, file);
                }
              }}
            />
          </label>
        </div>
      ) : (
        <div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto h-48 w-48 rounded-2xl object-cover border-2 border-primary-300 shadow-sm"
          />
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={capture}
              className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-8 py-2 text-sm font-medium text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 transition-colors"
            >
              <CameraIcon className="h-4 w-4" />
              Chụp
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-400">Nhìn thẳng vào camera · Đủ ánh sáng · Không đeo khẩu trang</p>
        </div>
      )}
    </div>
  );
}
