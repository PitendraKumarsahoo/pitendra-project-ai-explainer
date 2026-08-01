ALTER TABLE public.shared_reports
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoke_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

DROP POLICY IF EXISTS "Shared reports are publicly readable" ON public.shared_reports;

REVOKE SELECT ON public.shared_reports FROM anon;
REVOKE SELECT ON public.shared_reports FROM authenticated;
GRANT ALL ON public.shared_reports TO service_role;