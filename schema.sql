-- =====================================================================
-- SATYAM GOLD — COLLECTION APP  (PostgreSQL)
-- Adminer → SQL command में पूरा paste करके "Execute" दबाएँ (एक बार)
-- (DB: postgres, Schema: public)  — main app वाला same database
-- App भी पहली बार चलते ही यह tables अपने-आप बना लेता है; यह सिर्फ़ safety के लिए.
-- =====================================================================
CREATE TABLE IF NOT EXISTS sg_store (key TEXT PRIMARY KEY, value JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())*1000)::BIGINT, synced_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- OTP से login करने वाले (मुंशी) — नाम, short नाम, allowed area, logout time, OTP (2 मिनट)
CREATE TABLE IF NOT EXISTS coll_agents (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL,
  areas JSONB NOT NULL DEFAULT '["ALL"]', logout_time TEXT NOT NULL DEFAULT '23:59',
  otp TEXT, otp_expires TIMESTAMPTZ, gen INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- हर collection payment (Cash / Online / Mix) — किसने लिया
CREATE TABLE IF NOT EXISTS coll_payments (
  id BIGSERIAL PRIMARY KEY, pdate TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ts TEXT,
  cust_key TEXT NOT NULL, name TEXT NOT NULL, address TEXT, area TEXT,
  cash NUMERIC NOT NULL DEFAULT 0, online NUMERIC NOT NULL DEFAULT 0, mode TEXT NOT NULL,
  agent_id INT, agent_name TEXT, agent_short TEXT, source TEXT NOT NULL DEFAULT 'coll',
  nb_seen BOOLEAN NOT NULL DEFAULT false, cancelled BOOLEAN NOT NULL DEFAULT false);
CREATE INDEX IF NOT EXISTS coll_payments_date_idx ON coll_payments (pdate);

-- Collection से आए order (Main app Order Book में भी जाते हैं, short नाम tag के साथ)
CREATE TABLE IF NOT EXISTS coll_orders (
  id BIGSERIAL PRIMARY KEY, odate TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cust_key TEXT NOT NULL, name TEXT, address TEXT, items JSONB NOT NULL, ord_id TEXT, ord_no TEXT,
  agent_id INT, agent_name TEXT, agent_short TEXT, ob_seen BOOLEAN NOT NULL DEFAULT false);

-- NOT VISIT report के लिए — OTP user ने कौन सा area / customer profile खोला
CREATE TABLE IF NOT EXISTS coll_visits (
  id BIGSERIAL PRIMARY KEY, vdate TEXT NOT NULL, cust_key TEXT NOT NULL, area TEXT,
  agent_id INT, agent_name TEXT, kind TEXT NOT NULL DEFAULT 'profile',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (vdate, cust_key, agent_id, kind));

-- ===== v2 (नया): "बाद में" (date + time) + PACK (live — किसने कौन सा customer आज निपटा दिया) =====
CREATE TABLE IF NOT EXISTS coll_later (
  id BIGSERIAL PRIMARY KEY, cust_key TEXT NOT NULL, name TEXT, address TEXT, area TEXT,
  ldate TEXT NOT NULL, ltime TEXT NOT NULL DEFAULT '', amount NUMERIC NOT NULL DEFAULT 0, note TEXT,
  agent_id INT, agent_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done BOOLEAN NOT NULL DEFAULT false, done_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS coll_later_open_idx ON coll_later (done, ldate);

CREATE TABLE IF NOT EXISTS coll_packs (
  id BIGSERIAL PRIMARY KEY, pdate TEXT NOT NULL, cust_key TEXT NOT NULL, area TEXT,
  agent_id INT, agent_name TEXT, acts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pdate, cust_key));

-- देखने के लिए:
--   SELECT * FROM coll_later WHERE NOT done ORDER BY ldate, ltime;   -- pending "बाद में"
--   SELECT * FROM coll_packs ORDER BY id DESC LIMIT 50;              -- आज के PACK
--   SELECT * FROM coll_payments ORDER BY id DESC LIMIT 50;
--   SELECT agent_name, sum(cash) cash, sum(online) online FROM coll_payments WHERE pdate = to_char(now() AT TIME ZONE 'Asia/Kolkata','DD-MM-YYYY') AND NOT cancelled GROUP BY 1;
--   SELECT * FROM coll_orders ORDER BY id DESC LIMIT 50;
