<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';

import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Wallet, Building2, CalendarDays, ReceiptText, Eye, FileWarning, TimerReset, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../lib/formatters';
import { formatPaiementError } from '../services/domain/paiementService';
import { createPaiementViaEdge, PaiementApiError } from '../services/api/paiementApi';
import { emitEvent } from '../lib/eventBus';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { Tabs } from '../components/ui/Tabs';
import { LoadingState } from '../components/ui/LoadingState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { getOpenReceivables, type OpenReceivableStatus } from '../services/api/financeApi';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { FinanceDrawer, FinanceInfoCard, FinanceKpiGrid, FinanceLine, FinancePageHeader, FinanceStatusTabs } from '../components/finance/FinancePrimitives';

