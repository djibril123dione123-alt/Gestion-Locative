import { CheckoutModal } from '../billing/CheckoutModal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  priceXof: number;
  onSuccess: () => void;
}

const SUPPORTED_PLAN_IDS = new Set(['starter', 'basic', 'pro', 'business', 'enterprise']);

function resolvePlanId(planName: string) {
  const normalized = planName.trim().toLowerCase();
  return SUPPORTED_PLAN_IDS.has(normalized) ? normalized : 'pro';
}

/**
 * Compatibility adapter for legacy callers. Payment execution stays centralized
 * in CheckoutModal and its server-side initiate-payment workflow.
 */
export function PaymentModal(props: PaymentModalProps) {
  return <CheckoutModal {...props} planId={resolvePlanId(props.planName)} />;
}
