CREATE TABLE signup_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  token        text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status       text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  requested_at timestamptz NOT NULL DEFAULT now(),
  actioned_at  timestamptz
);
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only
