/**
 * Admin Dashboard JavaScript (Supabase Version)
 * C4S Food Solution Payroll System
 */

(async function() {
  'use strict';

  // =============================================
  // STATE
  // =============================================
  let employees = [];
  let attendance = [];
  let leaveRequests = [];
  let archivedEmployees = [];
  let payslips = [];
  let attendanceChart = null;

  // =============================================
  // DOM ELEMENTS
  // =============================================
  const els = {
    tbody: document.querySelector('#employeesTable tbody'),
    archiveTbody: document.querySelector('#archiveTable tbody'),
    attendanceTbody: document.querySelector('#attendanceTable tbody'),
    leavesTbody: document.querySelector('#leavesTable tbody'),
    search: document.getElementById('search'),
    modal: document.getElementById('modal'),
    form: document.getElementById('employeeForm'),
    modalTitle: document.getElementById('modalTitle'),
    homeEmployeeCount: document.getElementById('homeEmployeeCount'),
    pendingPayslipsCount: document.getElementById('pendingPayslipsCount'),
    pendingLeavesCount: document.getElementById('pendingLeavesCount'),
    homeLateCount: document.getElementById('homeLateCount'),
    homeAbsentCount: document.getElementById('homeAbsentCount')
  };

  // =============================================
  // INITIALIZATION
  // =============================================
  async function init() {
    try {
      await loadAllData();
      setupEventListeners();
      setupRealtimeSubscriptions();
      renderAll();
      switchSection('home');
    } catch (err) {
      console.error('Initialization error:', err);
      if (window.toastError) toastError('Error', 'Failed to load data. Please refresh.');
    }
  }

  async function loadAllData() {
    const [empData, attData, leaveData, archiveData, payslipData] = await Promise.all([
      db.getEmployees(),
      db.getAttendance(),
      db.getLeaveRequests(),
      db.getArchivedEmployees(),
      db.getPayslips()
    ]);
    employees = empData || [];
    attendance = attData || [];
    leaveRequests = leaveData || [];
    archivedEmployees = archiveData || [];
    payslips = payslipData || [];
  }

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================
  function setupRealtimeSubscriptions() {
    // Subscribe to employee changes
    db.subscribeToEmployees((payload) => {
      console.log('Employee change:', payload);
      loadAllData().then(renderAll);
    });

    // Subscribe to attendance changes
    db.subscribeToAttendance((payload) => {
      console.log('Attendance change:', payload);
      loadAllData().then(renderAll);
    });

    // Subscribe to leave request changes
    db.subscribeToLeaveRequests((payload) => {
      console.log('Leave request change:', payload);
      loadAllData().then(renderAll);
    });

    // Subscribe to payslip changes
    db.subscribeToPayslips((payload) => {
      console.log('Payslip change:', payload);
      loadAllData().then(() => {
        renderSalarySlips();
        updateHomeStats();
      });
    });
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================
  function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        switchSection(section);
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Search
    if (els.search) {
      els.search.addEventListener('input', renderEmployees);
    }

    // Employee form
    if (els.form) {
      els.form.addEventListener('submit', handleEmployeeSubmit);
    }

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // Cancel button in employee modal
    const cancelBtn = document.getElementById('cancelModal');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    // Add employee button
    const addBtn = document.getElementById('addEmployeeBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => openEmployeeModal());
    }

    // Chart navigation
    const chartPrevBtn = document.getElementById('chartPrevWeek');
    const chartNextBtn = document.getElementById('chartNextWeek');
    if (chartPrevBtn) chartPrevBtn.addEventListener('click', () => navigateChart(-1));
    if (chartNextBtn) chartNextBtn.addEventListener('click', () => navigateChart(1));

    // Attendance search
    const attendanceSearch = document.getElementById('attendanceSearch');
    if (attendanceSearch) {
      attendanceSearch.addEventListener('input', (e) => {
        attendanceSearchQuery = e.target.value.trim();
        attendancePage = 1;
        renderAttendance();
      });
    }

    // Attendance pagination
    const attendancePrev = document.getElementById('attendancePrev');
    const attendanceNext = document.getElementById('attendanceNext');
    if (attendancePrev) {
      attendancePrev.addEventListener('click', () => {
        if (attendancePage > 1) {
          attendancePage--;
          renderAttendance();
        }
      });
    }
    if (attendanceNext) {
      attendanceNext.addEventListener('click', () => {
        attendancePage++;
        renderAttendance();
      });
    }
  }

  // =============================================
  // SECTION SWITCHING
  // =============================================
  function switchSection(section) {
    document.querySelectorAll('.section-content').forEach(el => {
      el.classList.remove('active');
    });
    const sectionEl = document.getElementById(section);
    if (sectionEl) {
      sectionEl.classList.add('active');
    }

    // Render section-specific content
    if (section === 'employees') renderEmployees();
    if (section === 'attendance') renderAttendance();
    if (section === 'archive') renderArchive();
    if (section === 'leaves') renderLeaves();
    if (section === 'home') {
      updateHomeStats();
      renderAttendanceChart();
    }
    if (section === 'salary') renderSalarySlips();
    if (section === 'timeclock') renderTimeClock();
    if (section === 'payroll') renderPayroll();
  }

  // =============================================
  // RENDER FUNCTIONS
  // =============================================
  function renderAll() {
    updateHomeStats();
    renderEmployees();
    renderAttendance();
    renderArchive();
    renderLeaves();
    renderAttendanceChart();
    renderSalarySlips();
    renderPayroll();
    renderTimeClock();
  }

  function updateHomeStats() {
    if (els.homeEmployeeCount) els.homeEmployeeCount.textContent = employees.length;

    // Count pending payslips
    const pendingPayslips = payslips.filter(p => p.status === 'Pending').length;
    if (els.pendingPayslipsCount) els.pendingPayslipsCount.textContent = pendingPayslips;

    // Count pending leaves
    const pendingLeaves = leaveRequests.filter(l => l.status === 'Pending').length;
    if (els.pendingLeavesCount) els.pendingLeavesCount.textContent = pendingLeaves;

    // Count lates this week
    const weekStart = db.getWeekStart();
    const lates = attendance.filter(a => {
      return a.date >= weekStart && a.late_minutes > 0;
    }).length;
    if (els.homeLateCount) els.homeLateCount.textContent = lates;

    // Count absents would require comparing expected vs actual attendance
    if (els.homeAbsentCount) els.homeAbsentCount.textContent = '0';
  }

  function renderEmployees() {
    if (!els.tbody) return;

    const query = els.search ? els.search.value.toLowerCase().trim() : '';
    const filtered = query
      ? employees.filter(e => (e.name + e.role + e.id).toLowerCase().includes(query))
      : employees;

    els.tbody.innerHTML = '';
    filtered.forEach(emp => {
      const weeklySalary = (emp.salary / 52).toFixed(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${emp.role}</td>
        <td>₱${Number(weeklySalary).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="actions">
          <button class="secondary" onclick="editEmployee('${emp.id}')">Edit</button>
          <button class="warn" onclick="archiveEmployee('${emp.id}')">Remove</button>
        </td>
      `;
      els.tbody.appendChild(tr);
    });

    // Update count
    const countEl = document.getElementById('totalEmployees');
    if (countEl) countEl.textContent = filtered.length;
  }

  // Attendance pagination state
  let attendancePage = 1;
  const attendancePerPage = 15;
  let attendanceSearchQuery = '';

  function renderAttendance() {
    if (!els.attendanceTbody) return;

    els.attendanceTbody.innerHTML = '';

    // Filter by search query
    let filtered = [...attendance];
    if (attendanceSearchQuery) {
      const query = attendanceSearchQuery.toLowerCase();
      filtered = filtered.filter(att => {
        const emp = att.employees || {};
        return (emp.name || '').toLowerCase().includes(query) ||
               att.employee_id.toLowerCase().includes(query);
      });
    }

    // Sort by date descending
    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      els.attendanceTbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#6b7280">No attendance records found</td></tr>';
      updateAttendancePagination(0, 0);
      return;
    }

    // Paginate
    const totalPages = Math.ceil(sorted.length / attendancePerPage);
    if (attendancePage > totalPages) attendancePage = totalPages;
    if (attendancePage < 1) attendancePage = 1;

    const startIndex = (attendancePage - 1) * attendancePerPage;
    const pageData = sorted.slice(startIndex, startIndex + attendancePerPage);

    pageData.forEach(att => {
      const emp = att.employees || {};
      const workedHours = att.worked_hours !== null && att.worked_hours !== undefined
        ? att.worked_hours.toFixed(1) + 'h'
        : (att.time_out ? '0h' : '—');
      const statusClass = att.late_minutes > 0 ? 'color:#f59e0b' : 'color:#10b981';
      const statusText = att.late_minutes > 0 ? `Late (${att.late_minutes}m)` : 'On Time';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.date}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${emp.name || '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.employee_id}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.time_in ? new Date(att.time_in).toLocaleTimeString() : '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.time_out ? new Date(att.time_out).toLocaleTimeString() : '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${workedHours}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee;${statusClass};font-weight:600">${statusText}</td>
      `;
      els.attendanceTbody.appendChild(tr);
    });

    updateAttendancePagination(attendancePage, totalPages);
  }

  function updateAttendancePagination(current, total) {
    const indicator = document.getElementById('attendancePageIndicator');
    const prevBtn = document.getElementById('attendancePrev');
    const nextBtn = document.getElementById('attendanceNext');

    if (indicator) indicator.textContent = current;
    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= total;
  }

  function renderArchive() {
    if (!els.archiveTbody) return;

    els.archiveTbody.innerHTML = '';

    if (archivedEmployees.length === 0) {
      els.archiveTbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#6b7280">No archived employees</td></tr>';
      return;
    }

    archivedEmployees.forEach(emp => {
      const weeklySalary = (emp.salary / 52).toFixed(2);
      const archivedDate = emp.archived_at ? new Date(emp.archived_at).toLocaleDateString() : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${emp.role}</td>
        <td>₱${Number(weeklySalary).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="muted">Archived ${archivedDate}</td>
        <td class="actions">
          <button class="secondary" onclick="restoreEmployee('${emp.id}')">Restore</button>
        </td>
      `;
      els.archiveTbody.appendChild(tr);
    });
  }

  function renderLeaves() {
    if (!els.leavesTbody) return;

    els.leavesTbody.innerHTML = '';
    const sorted = [...leaveRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (sorted.length === 0) {
      els.leavesTbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#6b7280">No leave requests found</td></tr>';
      return;
    }

    sorted.forEach((leave, index) => {
      const emp = leave.employees || {};
      const statusClass = leave.status === 'Approved' ? 'badge-success' :
                         leave.status === 'Rejected' ? 'badge-error' :
                         leave.status === 'Cancelled' ? 'badge-neutral' : 'badge-warning';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:10px;border-bottom:1px solid #e6e9ee">${index + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee">${emp.name || leave.employee_id}</td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee">${leave.start_date} to ${leave.end_date}</td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee">${leave.reason || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee">${leave.leave_type}</td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee"><span class="badge ${statusClass}">${leave.status}</span></td>
        <td style="padding:10px;border-bottom:1px solid #e6e9ee" class="actions">
          ${leave.status === 'Pending' ? `
            <button class="secondary" onclick="approveLeave('${leave.id}')">Approve</button>
            <button class="warn" onclick="rejectLeave('${leave.id}')">Reject</button>
          ` : '—'}
        </td>
      `;
      els.leavesTbody.appendChild(tr);
    });

    // Update summary
    const summaryEl = document.getElementById('leavesSummary');
    if (summaryEl) {
      summaryEl.textContent = `Showing ${sorted.length} entries`;
    }
  }

  function renderSalarySlips() {
    const container = document.getElementById('salarySlipsContainer');
    if (!container) return;

    if (payslips.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="muted">No payslips yet. Run payroll first to generate salary slips.</p></div>';
      return;
    }

    let html = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Employee</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Week</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Gross Pay</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Deductions</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Net Pay</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:center">Status</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    payslips.forEach(slip => {
      const emp = slip.employees || {};
      const statusClass = slip.status === 'Approved' ? 'background:#d1fae5;color:#065f46' :
                         slip.status === 'Rejected' ? 'background:#fee2e2;color:#991b1b' :
                         'background:#fef3c7;color:#92400e';
      html += `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb">${emp.name || slip.employee_id}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb">${slip.week_start} to ${slip.week_end}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right">${db.formatCurrency(slip.gross_pay)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#ef4444">-${db.formatCurrency(slip.total_deductions)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#10b981">${db.formatCurrency(slip.net_pay)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;${statusClass}">${slip.status}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">
            ${slip.status === 'Pending' ? `
              <button onclick="approvePayslip('${slip.id}')" style="background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:4px">Approve</button>
              <button onclick="rejectPayslip('${slip.id}')" style="background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer">Reject</button>
            ` : '—'}
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Payslip approve/reject handlers
  window.approvePayslip = async function(id) {
    try {
      await db.updatePayslipStatus(id, 'Approved');
      if (window.toastSuccess) toastSuccess('Success', 'Payslip approved');
      await loadAllData();
      renderSalarySlips();
      updateHomeStats();
    } catch (err) {
      console.error('Error approving payslip:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to approve payslip');
    }
  };

  window.rejectPayslip = async function(id) {
    try {
      await db.updatePayslipStatus(id, 'Rejected');
      if (window.toastSuccess) toastSuccess('Success', 'Payslip rejected');
      await loadAllData();
      renderSalarySlips();
      updateHomeStats();
    } catch (err) {
      console.error('Error rejecting payslip:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to reject payslip');
    }
  };

  // =============================================
  // PAYROLL
  // =============================================
  let payrollWeekOffset = 0;

  function renderPayroll() {
    const employeeSelect = document.getElementById('payrollInlineEmployeeSelect');
    const weekSelect = document.getElementById('payrollInlineWeekSelect');

    if (!employeeSelect || !weekSelect) return;

    // Populate employee dropdown
    employeeSelect.innerHTML = '<option value="">Select Employee</option>';
    employees.forEach(emp => {
      employeeSelect.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.id})</option>`;
    });

    // Populate week dropdown (last 8 weeks)
    weekSelect.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const weekStart = getPayrollWeekStart(-i);
      const weekEnd = getPayrollWeekEnd(weekStart);
      const label = formatPayrollWeek(weekStart, weekEnd);
      const isCurrentWeek = i === 0 ? ' (Current)' : '';
      weekSelect.innerHTML += `<option value="${weekStart}">${label}${isCurrentWeek}</option>`;
    }

    // Reset calculation display
    resetPayrollCalculation();

    // Setup event listeners if not already setup
    if (!employeeSelect.dataset.listenersAttached) {
      employeeSelect.addEventListener('change', calculatePayroll);
      weekSelect.addEventListener('change', calculatePayroll);

      const lateHoursInput = document.getElementById('payrollInlineLateHours');
      const lateMinutesInput = document.getElementById('payrollInlineLateMinutes');
      if (lateHoursInput) lateHoursInput.addEventListener('input', calculatePayroll);
      if (lateMinutesInput) lateMinutesInput.addEventListener('input', calculatePayroll);

      const confirmBtn = document.getElementById('payrollInlineConfirm');
      const cancelBtn = document.getElementById('payrollInlineCancel');
      if (confirmBtn) confirmBtn.addEventListener('click', handlePayrollConfirm);
      if (cancelBtn) cancelBtn.addEventListener('click', resetPayrollCalculation);

      employeeSelect.dataset.listenersAttached = 'true';
    }
  }

  function getPayrollWeekStart(offsetWeeks = 0) {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + (offsetWeeks * 7));
    return monday.toISOString().split('T')[0];
  }

  function getPayrollWeekEnd(weekStart) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6); // Sunday
    return d.toISOString().split('T')[0];
  }

  function formatPayrollWeek(start, end) {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;
  }

  function resetPayrollCalculation() {
    const els = {
      days: document.getElementById('payrollInlineDays'),
      hours: document.getElementById('payrollInlineHours'),
      gross: document.getElementById('payrollInlineGross'),
      stat: document.getElementById('payrollInlineStat'),
      net: document.getElementById('payrollInlineNet'),
      notice: document.getElementById('payrollInlineNotice'),
      lateDeduction: document.getElementById('payrollInlineLateDeduction'),
      lateHours: document.getElementById('payrollInlineLateHours'),
      lateMinutes: document.getElementById('payrollInlineLateMinutes')
    };

    if (els.days) els.days.textContent = '0';
    if (els.hours) els.hours.textContent = '0';
    if (els.gross) els.gross.textContent = '₱0.00';
    if (els.stat) els.stat.textContent = '₱0.00';
    if (els.net) els.net.textContent = '₱0.00';
    if (els.notice) els.notice.textContent = '';
    if (els.lateDeduction) els.lateDeduction.textContent = '₱0.00';
    if (els.lateHours) els.lateHours.value = '0';
    if (els.lateMinutes) els.lateMinutes.value = '0';
  }

  function calculatePayroll() {
    const employeeSelect = document.getElementById('payrollInlineEmployeeSelect');
    const weekSelect = document.getElementById('payrollInlineWeekSelect');
    const employeeId = employeeSelect?.value;
    const weekStart = weekSelect?.value;

    if (!employeeId || !weekStart) {
      resetPayrollCalculation();
      return;
    }

    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const weekEnd = getPayrollWeekEnd(weekStart);

    // Get attendance for this employee for this week
    const weekAttendance = attendance.filter(a => {
      return a.employee_id === employeeId &&
             a.date >= weekStart &&
             a.date <= weekEnd;
    });

    // Calculate days worked and hours
    const daysWorked = weekAttendance.length;
    const totalHours = weekAttendance.reduce((sum, a) => sum + (a.worked_hours || 0), 0);
    const totalLateMinutes = weekAttendance.reduce((sum, a) => sum + (a.late_minutes || 0), 0);

    // Calculate gross pay (daily rate = annual salary / 52 weeks / 6 days)
    const dailyRate = emp.salary / 52 / 6;
    const grossPay = daysWorked * dailyRate;

    // Get statutory deductions
    const sss = emp.sss_deduction || 300;
    const philhealth = emp.philhealth_deduction || 250;
    const pagibig = emp.pagibig_deduction || 200;
    const statutoryDeductions = sss + philhealth + pagibig;

    // Get late deduction input
    const lateHours = parseFloat(document.getElementById('payrollInlineLateHours')?.value) || 0;
    const lateMinutes = parseFloat(document.getElementById('payrollInlineLateMinutes')?.value) || 0;
    const manualLateMins = (lateHours * 60) + lateMinutes;
    const totalLateMins = totalLateMinutes + manualLateMins;

    // Late deduction (hourly rate = daily rate / 8)
    const hourlyRate = dailyRate / 8;
    const lateDeduction = (totalLateMins / 60) * hourlyRate;

    // Net pay
    const netPay = grossPay - statutoryDeductions - lateDeduction;

    // Update display
    const els = {
      days: document.getElementById('payrollInlineDays'),
      hours: document.getElementById('payrollInlineHours'),
      gross: document.getElementById('payrollInlineGross'),
      stat: document.getElementById('payrollInlineStat'),
      net: document.getElementById('payrollInlineNet'),
      notice: document.getElementById('payrollInlineNotice'),
      lateDeduction: document.getElementById('payrollInlineLateDeduction')
    };

    if (els.days) els.days.textContent = daysWorked;
    if (els.hours) els.hours.textContent = totalHours.toFixed(1);
    if (els.gross) els.gross.textContent = db.formatCurrency(grossPay);
    if (els.stat) els.stat.textContent = db.formatCurrency(statutoryDeductions);
    if (els.net) els.net.textContent = db.formatCurrency(Math.max(0, netPay));
    if (els.lateDeduction) els.lateDeduction.textContent = db.formatCurrency(lateDeduction);

    // Check for warnings
    let notice = '';
    const existingPayslip = payslips.find(p => p.employee_id === employeeId && p.week_start === weekStart);
    if (existingPayslip) {
      notice = `Payslip already exists for this week (${existingPayslip.status}). Running payroll will update it.`;
    } else if (daysWorked === 0) {
      notice = 'No attendance records found for this week. Gross pay will be ₱0.00.';
    }
    if (els.notice) els.notice.textContent = notice;

    // Store calculation data for confirmation
    window._payrollData = {
      employeeId,
      weekStart,
      weekEnd,
      grossPay,
      sss: daysWorked > 0 ? sss : 0,
      philhealth: daysWorked > 0 ? philhealth : 0,
      pagibig: daysWorked > 0 ? pagibig : 0,
      lateDeduction: daysWorked > 0 ? lateDeduction : 0,
      totalDeductions: daysWorked > 0 ? (statutoryDeductions + lateDeduction) : 0,
      netPay: daysWorked > 0 ? Math.max(0, netPay) : 0,
      workedHours: totalHours,
      daysWorked
    };
  }

  async function handlePayrollConfirm() {
    const data = window._payrollData;
    if (!data || !data.employeeId) {
      if (window.toastError) toastError('Error', 'Please select an employee and week first');
      return;
    }

    // Warn if no days worked
    if (data.daysWorked === 0) {
      if (!confirm('No attendance records found for this week. This will create a payslip with ₱0.00 gross pay. Continue?')) {
        return;
      }
    }

    try {
      await db.upsertPayslip(data);
      if (window.toastSuccess) toastSuccess('Success', 'Payroll generated successfully');

      // Reset form
      const employeeSelect = document.getElementById('payrollInlineEmployeeSelect');
      if (employeeSelect) employeeSelect.value = '';
      resetPayrollCalculation();
      window._payrollData = null;

      // Reload data and re-render
      await loadAllData();
      renderSalarySlips();
      updateHomeStats();

    } catch (err) {
      console.error('Error generating payroll:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to generate payroll');
    }
  }

  function renderTimeClock() {
    const container = document.getElementById('timeclockContainer');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let html = `
      <div style="margin-bottom:16px;padding:12px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd">
        <div style="font-weight:600;color:#0369a1">Today: ${todayFormatted}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">ID</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Name</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Role</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Time In</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Time Out</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Status</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (employees.length === 0) {
      html += `<tr><td colspan="7" style="padding:24px;text-align:center;color:#6b7280">No employees found</td></tr>`;
    } else {
      employees.forEach(emp => {
        const todayAtt = attendance.find(a => a.employee_id === emp.id && a.date === today);
        const hasTimeIn = todayAtt && todayAtt.time_in;
        const hasTimeOut = todayAtt && todayAtt.time_out;

        let status, statusClass;
        if (!hasTimeIn) {
          status = 'Not Clocked In';
          statusClass = 'background:#fef3c7;color:#92400e';
        } else if (!hasTimeOut) {
          status = 'Working';
          statusClass = 'background:#d1fae5;color:#065f46';
        } else {
          status = 'Clocked Out';
          statusClass = 'background:#e5e7eb;color:#374151';
        }

        const timeIn = hasTimeIn ? new Date(todayAtt.time_in).toLocaleTimeString() : '—';
        const timeOut = hasTimeOut ? new Date(todayAtt.time_out).toLocaleTimeString() : '—';

        // Determine which button to show
        let actionBtn = '';
        if (!hasTimeIn) {
          actionBtn = `<button onclick="clockIn('${emp.id}')" style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">Time In</button>`;
        } else if (!hasTimeOut) {
          actionBtn = `<button onclick="clockOut('${emp.id}')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">Time Out</button>`;
        } else {
          actionBtn = `<span style="color:#6b7280">Done for today</span>`;
        }

        html += `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">${emp.id}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:600">${emp.name}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">${emp.role}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">${timeIn}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">${timeOut}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb"><span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;${statusClass}">${status}</span></td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">${actionBtn}</td>
          </tr>
        `;
      });
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Clock In function
  window.clockIn = async function(employeeId) {
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Employee not found');

      await db.timeIn(employeeId, emp.name, emp.role);
      if (window.toastSuccess) toastSuccess('Success', `${emp.name} clocked in`);

      await loadAllData();
      renderTimeClock();
      renderAttendance();
      updateHomeStats();
    } catch (err) {
      console.error('Clock in error:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to clock in');
    }
  };

  // Clock Out function
  window.clockOut = async function(employeeId) {
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Employee not found');

      await db.timeOut(employeeId);
      if (window.toastSuccess) toastSuccess('Success', `${emp.name} clocked out`);

      await loadAllData();
      renderTimeClock();
      renderAttendance();
      updateHomeStats();
    } catch (err) {
      console.error('Clock out error:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to clock out');
    }
  };

  // =============================================
  // ATTENDANCE CHART
  // =============================================
  let chartWeekOffset = 0;

  function renderAttendanceChart() {
    const canvas = document.getElementById('attendanceWeekChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const weekStart = getOffsetWeekStart(chartWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Update week label
    const labelEl = document.getElementById('chartWeekLabel');
    if (labelEl) {
      labelEl.textContent = formatWeekLabel(weekStart);
    }

    // Count attendance per day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [0, 0, 0, 0, 0, 0, 0];

    attendance.forEach(att => {
      const attDate = new Date(att.date + 'T00:00:00');
      if (attDate >= weekStart && attDate <= weekEnd) {
        const dayIndex = attDate.getDay();
        data[dayIndex]++;
      }
    });

    if (attendanceChart) {
      attendanceChart.data.datasets[0].data = data;
      attendanceChart.update();
    } else {
      attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: days,
          datasets: [{
            label: 'Employees Present',
            data: data,
            backgroundColor: 'rgba(30, 58, 95, 0.8)',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  function getOffsetWeekStart(offset) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek; // Days since Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - diff + (offset * 7));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  function formatWeekLabel(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }

  function navigateChart(direction) {
    chartWeekOffset += direction;
    if (chartWeekOffset > 0) chartWeekOffset = 0; // Can't go to future
    renderAttendanceChart();
  }

  // =============================================
  // EMPLOYEE CRUD
  // =============================================
  let editingEmployeeId = null;

  function openEmployeeModal(employeeId = null) {
    editingEmployeeId = employeeId;

    if (employeeId) {
      const emp = employees.find(e => e.id === employeeId);
      if (emp) {
        els.modalTitle.textContent = 'Edit Employee';
        document.getElementById('empName').value = emp.name;
        document.getElementById('empRole').value = emp.role;
        document.getElementById('empSalary').value = emp.salary;
        document.getElementById('empId').value = emp.id;
        document.getElementById('empSSS').value = emp.sss_deduction || 300;
        document.getElementById('empPhilhealth').value = emp.philhealth_deduction || 250;
        document.getElementById('empPagibig').value = emp.pagibig_deduction || 200;
      }
    } else {
      els.modalTitle.textContent = 'Add Employee';
      els.form.reset();
    }

    els.modal.style.display = 'flex';
  }

  function closeModal() {
    els.modal.style.display = 'none';
    editingEmployeeId = null;
  }

  async function handleEmployeeSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value.trim();
    const salary = parseFloat(document.getElementById('empSalary').value) || 159120;
    const sss = parseFloat(document.getElementById('empSSS').value) || 300;
    const philhealth = parseFloat(document.getElementById('empPhilhealth').value) || 250;
    const pagibig = parseFloat(document.getElementById('empPagibig').value) || 200;

    try {
      if (editingEmployeeId) {
        // Update existing employee
        await supabaseClient
          .from('employees')
          .update({
            name,
            role,
            salary,
            sss_deduction: sss,
            philhealth_deduction: philhealth,
            pagibig_deduction: pagibig
          })
          .eq('id', editingEmployeeId);

        if (window.toastSuccess) toastSuccess('Success', 'Employee updated successfully');
      } else {
        // This shouldn't happen - employees register themselves
        if (window.toastError) toastError('Error', 'Use registration page to add employees');
        return;
      }

      closeModal();
      await loadAllData();
      renderEmployees();
      updateHomeStats();

    } catch (err) {
      console.error('Error saving employee:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to save employee');
    }
  }

  window.editEmployee = function(id) {
    openEmployeeModal(id);
  };

  window.archiveEmployee = async function(id) {
    if (!confirm('Are you sure you want to archive this employee?')) return;

    try {
      await db.archiveEmployee(id);
      if (window.toastSuccess) toastSuccess('Success', 'Employee archived');
      await loadAllData();
      renderAll();
    } catch (err) {
      console.error('Error archiving employee:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to archive employee');
    }
  };

  window.restoreEmployee = async function(id) {
    try {
      await db.restoreEmployee(id);
      if (window.toastSuccess) toastSuccess('Success', 'Employee restored');
      await loadAllData();
      renderAll();
    } catch (err) {
      console.error('Error restoring employee:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to restore employee');
    }
  };

  // =============================================
  // LEAVE MANAGEMENT
  // =============================================
  window.approveLeave = async function(id) {
    try {
      await db.updateLeaveStatus(id, 'Approved');
      if (window.toastSuccess) toastSuccess('Success', 'Leave approved');
      await loadAllData();
      renderLeaves();
      updateHomeStats();
    } catch (err) {
      console.error('Error approving leave:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to approve leave');
    }
  };

  window.rejectLeave = async function(id) {
    const comment = prompt('Reason for rejection (optional):');
    try {
      await db.updateLeaveStatus(id, 'Rejected', comment);
      if (window.toastSuccess) toastSuccess('Success', 'Leave rejected');
      await loadAllData();
      renderLeaves();
      updateHomeStats();
    } catch (err) {
      console.error('Error rejecting leave:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to reject leave');
    }
  };

  // =============================================
  // INITIALIZE
  // =============================================
  init();

})();
