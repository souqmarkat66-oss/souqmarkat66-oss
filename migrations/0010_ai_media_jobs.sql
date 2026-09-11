-- Durable ownership and settlement state for asynchronous AI media providers.
-- A completed row means the corresponding AI credit transaction committed.
CREATE TABLE IF NOT EXISTS ai_media_jobs (
  id serial PRIMARY KEY,
  provider_job_id varchar(200) NOT NULL UNIQUE,
  user_id varchar NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  cached_result_url text,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_media_jobs_user_created_idx
  ON ai_media_jobs(user_id, created_at DESC);