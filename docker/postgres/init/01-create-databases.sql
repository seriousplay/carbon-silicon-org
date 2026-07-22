-- Initialize databases for all applications
-- This runs on first container start

-- Book application database
CREATE DATABASE csi_book OWNER csi_admin;

-- Loop Designer database
CREATE DATABASE csi_loop OWNER csi_admin;

-- LoopOS database
CREATE DATABASE csi_loopos OWNER csi_admin;

-- Workshops (no database needed, but create for future use)
-- CREATE DATABASE csi_workshops OWNER csi_admin;
