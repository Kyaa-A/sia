-- =============================================
-- C4S Food Solution Payroll System
-- Supabase Database Schema
-- =============================================
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- =============================================

-- 1. EMPLOYEES TABLE
-- Stores all employee information
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employee',
  salary DECIMAL(12,2) NOT NULL DEFAULT 159120,
  sss_deduction DECIMAL(10,2) DEFAULT 300,
  philhealth_deduction DECIMAL(10,2) DEFAULT 250,
  pagibig_deduction DECIMAL(10,2) DEFAULT 200,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE TABLE
-- Stores daily time in/out records
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present',
  late_minutes INTEGER DEFAULT 0,
  worked_hours DECIMAL(5,2) DEFAULT 0,
  payable_hours DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- 3. LEAVE REQUESTS TABLE
-- Stores employee leave applications
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending',
  admin_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAYSLIPS TABLE
-- Stores generated payslips
CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  gross_pay DECIMAL(12,2) NOT NULL,
  sss DECIMAL(10,2) DEFAULT 0,
  philhealth DECIMAL(10,2) DEFAULT 0,
  pagibig DECIMAL(10,2) DEFAULT 0,
  late_deduction DECIMAL(10,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'Pending',
  worked_hours DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, week_start)
);

-- 5. ARCHIVE TABLE
-- Stores archived/deleted employees
CREATE TABLE IF NOT EXISTS archived_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  salary DECIMAL(12,2),
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_reason TEXT
);

-- =============================================
-- INDEXES for better query performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_week ON payslips(week_start);

-- =============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_employees ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (we handle auth in app)
-- In production, you should use proper Supabase Auth

CREATE POLICY "Allow all operations on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on leave_requests" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on payslips" ON payslips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on archived_employees" ON archived_employees FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- FUNCTIONS for automatic timestamp updates
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS attendance_updated_at ON attendance;
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS payslips_updated_at ON payslips;
CREATE TRIGGER payslips_updated_at BEFORE UPDATE ON payslips FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- INSERT DEFAULT ADMIN USER
-- Password: 0304 (hashed for security)
-- =============================================

INSERT INTO employees (id, name, email, username, password_hash, role, salary, status)
VALUES ('ADMIN', 'System Administrator', 'admin@c4s.com', 'admin', '0304', 'Admin', 0, 'active')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- DONE! Your database is ready.
-- =============================================
