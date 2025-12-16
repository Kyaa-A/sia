-- ============================================
-- C4S Food Solution Payroll System
-- Supabase Database Schema
-- ============================================
-- Run this script in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,                    -- Employee ID (e.g., "1234")
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),                    -- Plain text in current impl, should hash
    role VARCHAR(100) NOT NULL,
    salary DECIMAL(12, 2) NOT NULL DEFAULT 159120, -- Annual salary (PHP)
    sss_deduction DECIMAL(10, 2) DEFAULT 300,
    philhealth_deduction DECIMAL(10, 2) DEFAULT 250,
    pagibig_deduction DECIMAL(10, 2) DEFAULT 200,
    last_net DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ============================================
-- ARCHIVED EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS archived_employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    username VARCHAR(100),
    role VARCHAR(100),
    salary DECIMAL(12, 2),
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_in TIMESTAMPTZ,
    time_out TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half-day')),
    late_minutes INTEGER DEFAULT 0,
    worked_hours DECIMAL(5, 2) DEFAULT 0,
    payable_hours DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(employee_id, date)
);

-- Indexes for attendance
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);

-- ============================================
-- LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    admin_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leave requests
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);

-- ============================================
-- PAYSLIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE,
    gross_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sss DECIMAL(10, 2) DEFAULT 0,
    philhealth DECIMAL(10, 2) DEFAULT 0,
    pagibig DECIMAL(10, 2) DEFAULT 0,
    late_deduction DECIMAL(10, 2) DEFAULT 0,
    total_deductions DECIMAL(10, 2) DEFAULT 0,
    net_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
    worked_hours DECIMAL(6, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(employee_id, week_start)
);

-- Indexes for payslips
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_week ON payslips(week_start);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS attendance_updated_at ON attendance;
CREATE TRIGGER attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS payslips_updated_at ON payslips;
CREATE TRIGGER payslips_updated_at
    BEFORE UPDATE ON payslips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_employees ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth setup)
-- These policies allow full access - customize for production

-- Employees: Allow all authenticated access
CREATE POLICY "Allow all access to employees"
    ON employees FOR ALL
    USING (true)
    WITH CHECK (true);

-- Attendance: Allow all authenticated access
CREATE POLICY "Allow all access to attendance"
    ON attendance FOR ALL
    USING (true)
    WITH CHECK (true);

-- Leave Requests: Allow all authenticated access
CREATE POLICY "Allow all access to leave_requests"
    ON leave_requests FOR ALL
    USING (true)
    WITH CHECK (true);

-- Payslips: Allow all authenticated access
CREATE POLICY "Allow all access to payslips"
    ON payslips FOR ALL
    USING (true)
    WITH CHECK (true);

-- Archived Employees: Allow all authenticated access
CREATE POLICY "Allow all access to archived_employees"
    ON archived_employees FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- Enable realtime for all tables (for subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE payslips;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample admin account
-- INSERT INTO employees (id, name, email, username, password_hash, role, salary)
-- VALUES ('ADMIN', 'Administrator', 'admin@c4s.com', 'admin', '0304', 'Admin', 0)
-- ON CONFLICT (id) DO NOTHING;
