import { Suspense } from 'react';
import SubscriptionsAdminClient from './SubscriptionsAdminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SubscriptionsAdminPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <SubscriptionsAdminClient />
    </Suspense>
  );
}
