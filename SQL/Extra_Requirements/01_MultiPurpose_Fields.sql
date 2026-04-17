-- ============================================================
-- Add Missing Fields for Multi-Purpose Room Bookings
-- ============================================================
-- Based on the System Requirements Document (SRD) section 5:
-- The electronic request form for Multi-Purpose Rooms must contain:
-- 1. Purpose of Use / Event Type
-- 2. Event Manager Details (Name, Job Title, Mobile Number)
-- 3. Technical Requirements (Mobile Microphones + Quantity, Laptop, Video Conference)

ALTER TABLE Bookings 
    ADD COLUMN purpose_of_use VARCHAR(255),
    ADD COLUMN event_manager_name VARCHAR(100),
    ADD COLUMN event_manager_job_title VARCHAR(100),
    ADD COLUMN event_manager_mobile VARCHAR(20),
    ADD COLUMN req_microphones BOOLEAN DEFAULT FALSE,
    ADD COLUMN req_mic_quantity INT DEFAULT 0,
    ADD COLUMN req_laptop BOOLEAN DEFAULT FALSE,
    ADD COLUMN req_video_conference BOOLEAN DEFAULT FALSE;
