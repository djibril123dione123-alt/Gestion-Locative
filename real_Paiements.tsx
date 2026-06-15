<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
  CreditCard,
  TrendingUp,
  Wallet,
  Percent,
  Clock,
  FileDown,
  Pencil,
  Ban,
  Sheet,
  Eye,
  FileCheck2,
  Mail,
  ReceiptText,
  XCircle,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { generatePaiementFacturePDF } from '../lib/pdf';
import { useToast } from '../hooks/useToast';
import { useTracking } from '../hooks/useTracking';
import { useExport } from '../hooks/useExport';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { formatCurrency } from '../lib/formatters';
import {
