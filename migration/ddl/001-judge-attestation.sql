-- Conflict-of-interest attestations, recorded server-side.
--
-- They lived in localStorage, keyed by judge email and category. That made
-- them a per-browser convenience with no evidence behind it: clearing site
-- data erased the record, and nothing on the server could show that a judge
-- had ever attested. For a declaration that exists to be relied on later,
-- that is the wrong place to keep it.
--
-- One row per judge per category, so the gate is asked once and the answer
-- survives. attested_at is the fact; created_date is bookkeeping.
--
-- Run once against the live database:
--   mysql -u <user> -p <database> < migration/ddl/001-judge-attestation.sql

CREATE TABLE IF NOT EXISTS `judge_attestation` (
  `id` VARCHAR(24) NOT NULL,
  `judge_email` VARCHAR(255) NOT NULL,
  `category` VARCHAR(128) NOT NULL,
  `attested_at` DATETIME(3) NOT NULL,
  `created_date` DATETIME(3) NULL,
  `updated_date` DATETIME(3) NULL,
  `created_by_id` VARCHAR(64) NULL,
  `is_sample` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  -- One attestation per judge per category. The insert relies on this rather
  -- than on a read-then-write, which two tabs would race.
  UNIQUE KEY `uq_judge_attestation` (`judge_email`, `category`),
  KEY `idx_judge_attestation_email` (`judge_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
