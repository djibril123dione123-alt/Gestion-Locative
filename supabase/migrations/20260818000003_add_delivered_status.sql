ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_status_check;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_status_check CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped'));
