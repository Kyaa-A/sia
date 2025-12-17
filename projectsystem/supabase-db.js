/**
 * Supabase Database Operations
 * C4S Food Solution Payroll System
 *
 * This file provides all database CRUD operations using Supabase
 */

// Helper to format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const db = {
  // =============================================
  // EMPLOYEE OPERATIONS
  // =============================================

  /**
   * Get all employees
   */
  async getEmployees() {
    const { data, error } = await supabaseClient
      .from('employees')
      .select('*')
      .neq('id', 'ADMIN')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get employee by ID
   */
  async getEmployee(id) {
    const { data, error } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get employee by email or username
   */
  async getEmployeeByEmailOrUsername(emailOrUsername) {
    const { data, error } = await supabaseClient
      .from('employees')
      .select('*')
      .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Check if email exists
   */
  async emailExists(email) {
    const { data, error } = await supabaseClient
      .from('employees')
      .select('id')
      .eq('email', email)
      .single();

    return !!data;
  },

  /**
   * Check if username exists
   */
  async usernameExists(username) {
    const { data, error } = await supabaseClient
      .from('employees')
      .select('id')
      .eq('username', username)
      .single();

    return !!data;
  },

  /**
   * Create new employee
   */
  async createEmployee(employee) {
    const { data, error } = await supabaseClient
      .from('employees')
      .insert([{
        id: employee.id,
        name: employee.name,
        email: employee.email,
        username: employee.username,
        password_hash: employee.password,
        role: employee.role,
        salary: employee.salary || 159120,
        sss_deduction: employee.sss || 300,
        philhealth_deduction: employee.philhealth || 250,
        pagibig_deduction: employee.pagibig || 200,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update employee
   */
  async updateEmployee(id, updates) {
    const { data, error } = await supabaseClient
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Archive employee (soft delete)
   */
  async archiveEmployee(id) {
    // First get the employee data
    const employee = await this.getEmployee(id);
    if (!employee) throw new Error('Employee not found');

    // Insert into archive
    await supabaseClient
      .from('archived_employees')
      .insert([{
        id: employee.id,
        name: employee.name,
        email: employee.email,
        username: employee.username,
        role: employee.role,
        salary: employee.salary
      }]);

    // Update status to archived
    const { error } = await supabaseClient
      .from('employees')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Restore employee from archive
   */
  async restoreEmployee(id) {
    // Update status back to active
    const { error } = await supabaseClient
      .from('employees')
      .update({ status: 'active' })
      .eq('id', id);

    if (error) throw error;

    // Remove from archive
    await supabaseClient
      .from('archived_employees')
      .delete()
      .eq('id', id);

    return true;
  },

  /**
   * Get archived employees
   */
  async getArchivedEmployees() {
    const { data, error } = await supabaseClient
      .from('archived_employees')
      .select('*')
      .order('archived_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // =============================================
  // AUTHENTICATION
  // =============================================

  /**
   * Login with email/username and password
   */
  async login(emailOrUsername, password) {
    // Check for admin
    if (emailOrUsername === 'admin' && password === '0304') {
      return { id: 'ADMIN', name: 'Admin', role: 'Admin', isAdmin: true };
    }

    // Find employee by email or username
    const { data, error } = await supabaseClient
      .from('employees')
      .select('*')
      .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      throw new Error('Invalid email/username or password');
    }

    // Check password
    if (data.password_hash !== password) {
      throw new Error('Invalid email/username or password');
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      username: data.username,
      role: data.role,
      isAdmin: false
    };
  },

  // =============================================
  // ATTENDANCE OPERATIONS
  // =============================================

  /**
   * Get attendance records
   */
  async getAttendance(filters = {}) {
    let query = supabaseClient
      .from('attendance')
      .select(`
        *,
        employees(name, role)
      `)
      .order('date', { ascending: false })
      .order('time_in', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    if (filters.date) {
      query = query.eq('date', filters.date);
    }
    if (filters.startDate && filters.endDate) {
      query = query.gte('date', filters.startDate).lte('date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get today's attendance for an employee
   */
  async getTodayAttendance(employeeId) {
    const today = formatDateLocal(new Date());
    const { data, error } = await supabaseClient
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Time In
   */
  async timeIn(employeeId, employeeName, employeeRole) {
    const now = new Date();
    const today = formatDateLocal(now);

    // Check if already timed in today (First In, Last Out rule)
    const existing = await this.getTodayAttendance(employeeId);
    if (existing && existing.time_in) {
      // Already timed in - preserve first time_in, allow re-entry
      // Return existing record without error (First In preserved)
      return existing;
    }

    // Calculate late minutes (after 8:10 AM) - only for first time_in
    const scheduledMinutes = 8 * 60; // 8:00 AM
    const graceMinutes = 10;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const lateMinutes = currentMinutes > (scheduledMinutes + graceMinutes)
      ? currentMinutes - scheduledMinutes
      : 0;

    const { data, error } = await supabaseClient
      .from('attendance')
      .upsert([{
        employee_id: employeeId,
        date: today,
        time_in: now.toISOString(),
        status: 'present',
        late_minutes: lateMinutes
      }], { onConflict: 'employee_id,date' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Time Out
   */
  async timeOut(employeeId) {
    const now = new Date();
    const today = formatDateLocal(now);

    // Get today's attendance
    const existing = await this.getTodayAttendance(employeeId);
    if (!existing) {
      throw new Error('No time in record for today');
    }

    // Calculate worked hours
    const timeIn = new Date(existing.time_in);
    let workedMinutes = Math.round((now - timeIn) / (1000 * 60));

    // Subtract lunch break (12:00-13:00)
    const startMinutes = timeIn.getHours() * 60 + timeIn.getMinutes();
    const endMinutes = now.getHours() * 60 + now.getMinutes();
    if (startMinutes < 13 * 60 && endMinutes > 12 * 60) {
      workedMinutes -= Math.min(60, Math.min(endMinutes, 13 * 60) - Math.max(startMinutes, 12 * 60));
    }

    const workedHours = Math.round((workedMinutes / 60) * 100) / 100;
    const payableHours = Math.min(workedHours, 8);

    const { data, error } = await supabaseClient
      .from('attendance')
      .update({
        time_out: now.toISOString(),
        worked_hours: workedHours,
        payable_hours: payableHours
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cancel Time In (delete today's attendance record)
   */
  async cancelTimeIn(employeeId) {
    const today = formatDateLocal(new Date());

    // Get today's attendance
    const existing = await this.getTodayAttendance(employeeId);
    if (!existing) {
      throw new Error('No time in record to cancel');
    }

    // Only allow cancel if not yet timed out
    if (existing.time_out) {
      throw new Error('Cannot cancel - employee has already timed out');
    }

    // Delete the attendance record
    const { error } = await supabaseClient
      .from('attendance')
      .delete()
      .eq('id', existing.id);

    if (error) throw error;
    return { success: true, message: 'Time in cancelled successfully' };
  },

  /**
   * Update attendance with photo (for QR kiosk)
   */
  async updateAttendancePhoto(employeeId, date, photoBase64, photoType = 'time_in') {
    try {
      // Get the attendance record
      const { data: existing, error: fetchError } = await supabaseClient
        .from('attendance')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .single();

      if (fetchError || !existing) {
        console.warn('No attendance record found for photo update');
        return null;
      }

      // Update with photo - store in appropriate column based on type
      const updateData = {};
      if (photoType === 'time_in') {
        updateData.photo_in = photoBase64;
      } else {
        updateData.photo_out = photoBase64;
      }

      const { data, error } = await supabaseClient
        .from('attendance')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      // If column doesn't exist, log warning but don't fail
      if (error) {
        console.warn('Could not save photo (column may not exist):', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.warn('Photo update error:', err);
      return null;
    }
  },

  // =============================================
  // LEAVE REQUEST OPERATIONS
  // =============================================

  /**
   * Get leave requests
   */
  async getLeaveRequests(filters = {}) {
    let query = supabaseClient
      .from('leave_requests')
      .select(`
        *,
        employees(name, role)
      `)
      .order('created_at', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create leave request
   */
  async createLeaveRequest(request) {
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .insert([{
        employee_id: request.employeeId,
        leave_type: request.leaveType,
        start_date: request.startDate,
        end_date: request.endDate,
        reason: request.reason,
        status: 'Pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update leave request status (approve/reject)
   */
  async updateLeaveStatus(id, status, adminComment = null) {
    const { data, error } = await supabaseClient
      .from('leave_requests')
      .update({
        status: status,
        admin_comment: adminComment
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cancel leave request
   */
  async cancelLeaveRequest(id) {
    return this.updateLeaveStatus(id, 'Cancelled');
  },

  // =============================================
  // PAYSLIP OPERATIONS
  // =============================================

  /**
   * Get payslips
   */
  async getPayslips(filters = {}) {
    let query = supabaseClient
      .from('payslips')
      .select(`
        *,
        employees(name, role)
      `)
      .order('week_start', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.weekStart) {
      query = query.eq('week_start', filters.weekStart);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create or update payslip
   */
  async upsertPayslip(payslip) {
    const { data, error } = await supabaseClient
      .from('payslips')
      .upsert([{
        employee_id: payslip.employeeId,
        week_start: payslip.weekStart,
        week_end: payslip.weekEnd,
        period_type: payslip.periodType || 'weekly',
        gross_pay: payslip.grossPay,
        sss: payslip.sss || 0,
        philhealth: payslip.philhealth || 0,
        pagibig: payslip.pagibig || 0,
        late_deduction: payslip.lateDeduction || 0,
        total_deductions: payslip.totalDeductions || 0,
        net_pay: payslip.netPay,
        worked_hours: payslip.workedHours || 0,
        payable_hours: payslip.payableHours || 0,
        late_minutes: payslip.lateMinutes || 0,
        status: payslip.status || 'Pending'
      }], { onConflict: 'employee_id,week_start' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update payslip status
   */
  async updatePayslipStatus(id, status) {
    const { data, error } = await supabaseClient
      .from('payslips')
      .update({ status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================

  /**
   * Subscribe to employee changes
   */
  subscribeToEmployees(callback) {
    return supabaseClient
      .channel('employees-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, callback)
      .subscribe();
  },

  /**
   * Subscribe to attendance changes
   */
  subscribeToAttendance(callback) {
    return supabaseClient
      .channel('attendance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, callback)
      .subscribe();
  },

  /**
   * Subscribe to leave request changes
   */
  subscribeToLeaveRequests(callback) {
    return supabaseClient
      .channel('leave-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, callback)
      .subscribe();
  },

  /**
   * Subscribe to payslip changes
   */
  subscribeToPayslips(callback) {
    return supabaseClient
      .channel('payslips-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payslips' }, callback)
      .subscribe();
  },

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  /**
   * Generate unique employee ID (4 digits)
   */
  async generateEmployeeId() {
    const { data } = await supabaseClient
      .from('employees')
      .select('id');

    const existingIds = (data || []).map(e => e.id);
    let code;
    let attempts = 0;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      attempts++;
    } while (existingIds.includes(code) && attempts < 100);

    return code;
  },

  /**
   * Get week start date (Monday)
   */
  getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return formatDateLocal(d);
  },

  /**
   * Format currency (PHP)
   */
  formatCurrency(amount) {
    return '₱' + Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};

// Export
window.db = db;
