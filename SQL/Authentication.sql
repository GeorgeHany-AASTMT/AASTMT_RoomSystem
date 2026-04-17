-- ============================================================
-- Database: AASTMT Room Management System
-- Description: Core schema for RBAC and Room Booking
-- ============================================================

-- 1. Roles Table: Defines the RBAC architecture
CREATE TABLE Roles (
    role_id   INT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL -- Admin, Branch Manager, Employee, Secretary
);

-- 2. Users Table: Handles Authentication and Sign-up
-- user_id follows the pattern (1xxxx for Admin, 2xxxx for Branch Manager, etc.)
CREATE TABLE Users (
    user_id        INT PRIMARY KEY,        -- Employee ID acts as the Primary Unique Identifier
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL COLLATE utf8mb4_unicode_ci, -- Case-insensitive unique
    password       VARCHAR(255) NOT NULL,  -- Store as a bcrypt/hashed value in production
    ssn            VARCHAR(20)  UNIQUE NOT NULL,
    birthday       DATE         NOT NULL,
    role_id        INT,
    is_active      BOOLEAN      DEFAULT TRUE,
    remember_token VARCHAR(100),           -- For "Remember Me" functionality
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

-- 3. Room Categories: Lecture vs Multi-Purpose
CREATE TABLE Room_Types (
    type_id   INT PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL -- 'Lecture Room' or 'Multi-Purpose Room'
);

-- 4. Rooms Table: Stores physical room data
CREATE TABLE Rooms (
    room_id   INT PRIMARY KEY AUTO_INCREMENT,
    room_name VARCHAR(100) NOT NULL,
    type_id   INT,
    FOREIGN KEY (type_id) REFERENCES Room_Types(type_id)
);

-- 5. Bookings Table: Manages Schedules and Requests
CREATE TABLE Bookings (
    booking_id              INT PRIMARY KEY AUTO_INCREMENT,
    user_id                 INT,  -- Requester
    room_id                 INT,
    booking_date            DATE  NOT NULL,
    start_time              TIME  NOT NULL,
    end_time                TIME  NOT NULL,
    booking_type            ENUM('Fixed', 'Exceptional', 'Event') NOT NULL,
    status                  ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    rejection_reason        TEXT,    -- Admin suggestion / reason for rejection
    requires_branch_approval BOOLEAN DEFAULT FALSE, -- Specifically for Multi-Purpose rooms
    FOREIGN KEY (user_id)  REFERENCES Users(user_id),
    FOREIGN KEY (room_id)  REFERENCES Rooms(room_id)
);

-- 6. Delegations Table: Temporary Access
CREATE TABLE Delegations (
    delegation_id      INT PRIMARY KEY AUTO_INCREMENT,
    original_user_id   INT,
    substitute_user_id INT,
    start_date         DATE NOT NULL,
    end_date           DATE NOT NULL,
    FOREIGN KEY (original_user_id)   REFERENCES Users(user_id),
    FOREIGN KEY (substitute_user_id) REFERENCES Users(user_id)
);

-- ============================================================
-- EMAIL CASE-INSENSITIVITY TRIGGERS
-- Ensures george@gmail.com and George@gmail.com are always
-- stored and compared as the same address.
-- ============================================================

DELIMITER //

CREATE TRIGGER trg_users_lower_email_insert
BEFORE INSERT ON Users
FOR EACH ROW
BEGIN
    SET NEW.email = LOWER(NEW.email);
END //

CREATE TRIGGER trg_users_lower_email_update
BEFORE UPDATE ON Users
FOR EACH ROW
BEGIN
    SET NEW.email = LOWER(NEW.email);
END //

DELIMITER ;

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Insert Roles
INSERT INTO Roles (role_id, role_name) VALUES
(1, 'Admin'),
(2, 'Branch Manager'),
(3, 'Employee'),
(4, 'College Secretary');

-- Insert Room Types
INSERT INTO Room_Types (type_id, type_name) VALUES
(1, 'Lecture Room'),
(2, 'Multi-Purpose Room');

-- Sample Initial Admin and Manager
-- NOTE: Passwords are hashed here using SHA2-256 (MySQL built-in).
--       In production, hashing should be done at the application layer using bcrypt.
--       SHA2('password123', 256) => a SHA-256 hex digest stored in the password column.
INSERT INTO Users (user_id, name, email, password, ssn, birthday, role_id) VALUES
(10001, 'Main Admin',  'admin@aast.edu',   SHA2('password123', 256), 'SSN111', '1990-01-01', 1),
(20001, 'Branch Head', 'manager@aast.edu', SHA2('password123', 256), 'SSN222', '1985-05-05', 2);