-- ============================================================
-- Add Department Field to Users
-- ============================================================
-- Based on the Stitch MCP Component Design mapping.
-- The Frontend form expects users to select a specific Department upon registration.

ALTER TABLE Users
    ADD COLUMN department VARCHAR(100);
