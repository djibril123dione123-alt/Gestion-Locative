import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import {
  cleanupTemporaryDocuments,
  markOrphanDocumentRecords,
  optimizeDocumentStorage,
} from '../documentStorage';

describe('document storage maintenance commands', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
  });

  it('uses the guarded tenant cleanup command', async () => {
    await cleanupTemporaryDocuments('agency-1', 45);

    expect(rpcMock).toHaveBeenCalledWith('tenant_cleanup_temporary_documents', {
      p_agency_id: 'agency-1',
      p_older_than_days: 45,
    });
  });

  it('uses the guarded tenant orphan command', async () => {
    await markOrphanDocumentRecords('agency-1');

    expect(rpcMock).toHaveBeenCalledWith('tenant_mark_orphan_document_records', {
      p_agency_id: 'agency-1',
    });
  });

  it('uses the guarded tenant optimization command', async () => {
    await optimizeDocumentStorage('agency-1');

    expect(rpcMock).toHaveBeenCalledWith('tenant_optimize_document_storage', {
      p_agency_id: 'agency-1',
    });
  });
});
