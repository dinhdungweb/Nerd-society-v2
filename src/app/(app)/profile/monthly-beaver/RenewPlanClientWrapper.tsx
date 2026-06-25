'use client';

import React, { useState } from 'react';
import RenewPlanModal from './RenewPlanModal';

interface RenewPlanClientWrapperProps {
  subscriberId: string;
  currentPlanType?: string;
  walletBalance?: number;
  walletStatus?: string;
}

export default function RenewPlanClientWrapper({
  subscriberId,
  currentPlanType,
  walletBalance,
  walletStatus,
}: RenewPlanClientWrapperProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-4 inline-flex rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-600 active:scale-95"
      >
        Gia hạn gói
      </button>

      <RenewPlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        subscriberId={subscriberId}
        currentPlanType={currentPlanType}
        walletBalance={walletBalance}
        walletStatus={walletStatus}
      />
    </>
  );
}
