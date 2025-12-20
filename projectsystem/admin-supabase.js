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
  let leavesSearchQuery = '';

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
      await migrateAnnualToDaily(); // Auto-migrate old annual salary to daily rate
      setupEventListeners();
      setupRealtimeSubscriptions();
      renderAll();
      switchSection('home');
    } catch (err) {
      console.error('Initialization error:', err);
      if (window.toastError) toastError('Error', 'Failed to load data. Please refresh.');
    }
  }

  // Migrate employees with old annual salary (>2000) to daily rate
  async function migrateAnnualToDaily() {
    // Migrate active employees
    const toMigrate = employees.filter(emp => emp.salary > 2000);
    // Migrate archived employees too
    const archivedToMigrate = archivedEmployees.filter(emp => emp.salary > 2000);

    const totalToMigrate = toMigrate.length + archivedToMigrate.length;
    if (totalToMigrate === 0) return;

    console.log(`Found ${totalToMigrate} employees with annual salary to migrate...`);
    let migratedCount = 0;

    // Migrate active employees
    for (const emp of toMigrate) {
      const dailyRate = Math.round((emp.salary / 52 / 6) * 100) / 100;
      console.log(`Migrating ${emp.name}: ₱${emp.salary} (annual) → ₱${dailyRate} (daily)`);

      try {
        const { error } = await supabaseClient
          .from('employees')
          .update({ salary: dailyRate })
          .eq('id', emp.id);

        if (!error) {
          emp.salary = dailyRate;
          migratedCount++;
        }
      } catch (err) {
        console.error(`Failed to migrate ${emp.name}:`, err);
      }
    }

    // Migrate archived employees
    for (const emp of archivedToMigrate) {
      const dailyRate = Math.round((emp.salary / 52 / 6) * 100) / 100;
      console.log(`Migrating archived ${emp.name}: ₱${emp.salary} (annual) → ₱${dailyRate} (daily)`);

      try {
        const { error } = await supabaseClient
          .from('archived_employees')
          .update({ salary: dailyRate })
          .eq('id', emp.id);

        if (!error) {
          emp.salary = dailyRate;
          migratedCount++;
        }
      } catch (err) {
        console.error(`Failed to migrate archived ${emp.name}:`, err);
      }
    }

    if (migratedCount > 0) {
      if (window.toastSuccess) {
        toastSuccess('Migration Complete', `Converted ${migratedCount} employee(s) from annual salary to daily rate`);
      }
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

    // Bulk update button
    const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
    if (bulkUpdateBtn) {
      bulkUpdateBtn.addEventListener('click', handleBulkUpdate);
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
    renderSidePayslipList();
    renderPerformanceChart();
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
    const [y, m, d] = weekStart.split('-').map(Number);
    const weekEnd = new Date(y, m - 1, d + 6);
    const weekEndStr = formatDateLocal(weekEnd);

    const lates = attendance.filter(a => {
      return a.date >= weekStart && a.date <= weekEndStr && a.late_minutes > 0;
    }).length;
    if (els.homeLateCount) els.homeLateCount.textContent = lates;

    // Count absents this week (expected days - actual attendance)
    const expectedDaysPerEmployee = 6; // Mon-Sat
    const totalExpected = employees.length * expectedDaysPerEmployee;
    const actualAttendance = attendance.filter(a => a.date >= weekStart && a.date <= weekEndStr).length;
    const absents = Math.max(0, totalExpected - actualAttendance);
    if (els.homeAbsentCount) els.homeAbsentCount.textContent = absents;
  }

  function renderEmployees() {
    if (!els.tbody) return;

    const query = els.search ? els.search.value.toLowerCase().trim() : '';
    const filtered = query
      ? employees.filter(e => (e.name + e.role + e.id).toLowerCase().includes(query))
      : employees;

    els.tbody.innerHTML = '';
    filtered.forEach(emp => {
      const dailyRate = emp.salary || 510;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${emp.role}</td>
        <td>₱${Number(dailyRate).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="actions">
          <button style="background:#6366f1;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer" onclick="showEmployeeQR('${emp.id}', '${emp.name.replace(/'/g, "\\'")}')">QR</button>
          <button style="background:#0ea5e9;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer" onclick="viewEmployeePayslips('${emp.id}', '${emp.name.replace(/'/g, "\\'")}')">Payslips</button>
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

  // Attendance pagination and week filter state
  let attendancePage = 1;
  let attendancePerPage = 15;
  let attendanceSearchQuery = '';
  let attendanceWeekOffset = 0;

  function renderAttendance() {
    if (!els.attendanceTbody) return;

    els.attendanceTbody.innerHTML = '';

    // Get the selected week range
    const weekStart = getOffsetWeekStart(attendanceWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = formatDateLocal(weekStart);
    const weekEndStr = formatDateLocal(weekEnd);

    // Update week label
    const weekRangeEl = document.getElementById('attendanceWeekRange');
    if (weekRangeEl) {
      weekRangeEl.textContent = formatWeekLabel(weekStart);
    }

    // Filter by week
    let filtered = attendance.filter(att => {
      return att.date >= weekStartStr && att.date <= weekEndStr;
    });

    // Filter by search query
    if (attendanceSearchQuery) {
      const query = attendanceSearchQuery.toLowerCase();
      filtered = filtered.filter(att => {
        const emp = att.employees || {};
        return (emp.name || '').toLowerCase().includes(query) ||
               att.employee_id.toLowerCase().includes(query);
      });
    }

    // Sort by date descending, then by time
    const sorted = filtered.sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.time_in || 0) - new Date(a.time_in || 0);
    });

    if (sorted.length === 0) {
      els.attendanceTbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#4b5563">No attendance records for this week</td></tr>';
      updateAttendancePagination(0, 0, 0, 0, 0);
      return;
    }

    // Paginate (handle "all" option)
    const showAll = attendancePerPage === 'all' || attendancePerPage >= sorted.length;
    const perPage = showAll ? sorted.length : attendancePerPage;
    const totalPages = showAll ? 1 : Math.ceil(sorted.length / perPage);
    if (attendancePage > totalPages) attendancePage = totalPages;
    if (attendancePage < 1) attendancePage = 1;

    const startIndex = showAll ? 0 : (attendancePage - 1) * perPage;
    const endIndex = showAll ? sorted.length : startIndex + perPage;
    const pageData = sorted.slice(startIndex, endIndex);

    pageData.forEach(att => {
      const emp = att.employees || {};
      const workedHours = att.worked_hours !== null && att.worked_hours !== undefined
        ? att.worked_hours.toFixed(1) + 'h'
        : (att.time_out ? '0h' : '—');

      // Calculate payable hours (max 8h per day)
      const payableHours = att.payable_hours !== null && att.payable_hours !== undefined
        ? att.payable_hours.toFixed(1) + 'h'
        : '—';

      const statusClass = att.late_minutes > 0 ? 'color:#f59e0b' : 'color:#10b981';
      const statusText = att.late_minutes > 0 ? `Late (${att.late_minutes}m)` : 'On Time';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.date}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">
          <div style="font-weight:600">${emp.name || '—'}</div>
          <div style="font-size:12px;color:#4b5563">${att.employee_id}</div>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee;font-size:12px;color:#4b5563">${att.id ? att.id.substring(0, 8) + '...' : '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.time_in ? new Date(att.time_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">${att.time_out ? new Date(att.time_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee">
          <div>${workedHours}</div>
          <div style="font-size:11px;color:#4b5563">paid: ${payableHours}</div>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #e6e9ee;${statusClass};font-weight:600">${statusText}</td>
      `;
      els.attendanceTbody.appendChild(tr);
    });

    updateAttendancePagination(attendancePage, totalPages, sorted.length, startIndex + 1, Math.min(endIndex, sorted.length));
  }

  // Page size selector
  document.getElementById('attendancePageSize')?.addEventListener('change', (e) => {
    const val = e.target.value;
    attendancePerPage = val === 'all' ? 'all' : parseInt(val, 10);
    attendancePage = 1;
    renderAttendance();
  });

  // Attendance week navigation
  document.getElementById('attWeekPrev')?.addEventListener('click', () => {
    attendanceWeekOffset--;
    attendancePage = 1;
    renderAttendance();
  });

  document.getElementById('attWeekNext')?.addEventListener('click', () => {
    attendanceWeekOffset++;
    attendancePage = 1;
    renderAttendance();
  });

  // Salary Slips search and pagination
  document.getElementById('salarySlipsSearch')?.addEventListener('input', (e) => {
    salarySlipsSearchTerm = e.target.value.trim();
    salarySlipsPage = 1;
    renderSalarySlips();
  });

  document.getElementById('salarySlipsPrev')?.addEventListener('click', () => {
    if (salarySlipsPage > 1) {
      salarySlipsPage--;
      renderSalarySlips();
    }
  });

  document.getElementById('salarySlipsNext')?.addEventListener('click', () => {
    salarySlipsPage++;
    renderSalarySlips();
  });

  function updateAttendancePagination(current, total, recordCount, rangeStart, rangeEnd) {
    const indicator = document.getElementById('attendancePageIndicator');
    const prevBtn = document.getElementById('attendancePrev');
    const nextBtn = document.getElementById('attendanceNext');
    const countEl = document.getElementById('attendanceRecordCount');

    // Handle empty state
    if (total === 0 || recordCount === 0) {
      if (indicator) indicator.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (countEl) countEl.textContent = 'No records';
      return;
    }

    // Hide pagination controls if only 1 page
    if (total <= 1) {
      if (indicator) indicator.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
    } else {
      if (indicator) { indicator.style.display = ''; indicator.textContent = `${current} / ${total}`; }
      if (prevBtn) { prevBtn.style.display = ''; prevBtn.disabled = current <= 1; }
      if (nextBtn) { nextBtn.style.display = ''; nextBtn.disabled = current >= total; }
    }

    if (countEl) countEl.textContent = `Showing ${rangeStart}-${rangeEnd} of ${recordCount}`;
  }

  function renderArchive() {
    if (!els.archiveTbody) return;

    els.archiveTbody.innerHTML = '';

    if (archivedEmployees.length === 0) {
      els.archiveTbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#4b5563">No archived employees</td></tr>';
      return;
    }

    archivedEmployees.forEach(emp => {
      const dailyRate = emp.salary || 510;
      const archivedDate = emp.archived_at ? new Date(emp.archived_at).toLocaleDateString() : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${emp.role}</td>
        <td>₱${Number(dailyRate).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
    let sorted = [...leaveRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter by search query
    if (leavesSearchQuery) {
      const query = leavesSearchQuery.toLowerCase();
      sorted = sorted.filter(leave => {
        const emp = leave.employees || {};
        const empName = (emp.name || '').toLowerCase();
        const empId = (leave.employee_id || '').toLowerCase();
        const reason = (leave.reason || '').toLowerCase();
        const leaveType = (leave.leave_type || '').toLowerCase();
        const status = (leave.status || '').toLowerCase();
        return empName.includes(query) || empId.includes(query) || reason.includes(query) || leaveType.includes(query) || status.includes(query);
      });
    }

    if (sorted.length === 0) {
      const message = leavesSearchQuery ? 'No matching leave requests found' : 'No leave requests found';
      els.leavesTbody.innerHTML = `<tr><td colspan="7" style="padding:24px;text-align:center;color:#4b5563">${message}</td></tr>`;
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

  // Salary slips pagination and search state
  let salarySlipsPage = 1;
  const salarySlipsPerPage = 10;
  let salarySlipsSearchTerm = '';

  function renderSalarySlips() {
    const container = document.getElementById('salarySlipsContainer');
    const pageEl = document.getElementById('salarySlipsPage');
    const infoEl = document.getElementById('salarySlipsInfo');
    const prevBtn = document.getElementById('salarySlipsPrev');
    const nextBtn = document.getElementById('salarySlipsNext');
    if (!container) return;

    // Sort by ID descending (newest created first)
    let filtered = [...payslips].sort((a, b) => {
      return (b.id || 0) - (a.id || 0);
    });
    if (salarySlipsSearchTerm) {
      const term = salarySlipsSearchTerm.toLowerCase();
      filtered = filtered.filter(slip => {
        const emp = slip.employees || {};
        const name = (emp.name || '').toLowerCase();
        const id = (slip.employee_id || '').toLowerCase();
        return name.includes(term) || id.includes(term);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="muted">No payslips found.</p></div>';
      if (pageEl) pageEl.textContent = 'Page 0';
      if (infoEl) infoEl.textContent = '0 results';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / salarySlipsPerPage);
    if (salarySlipsPage > totalPages) salarySlipsPage = totalPages;
    if (salarySlipsPage < 1) salarySlipsPage = 1;

    const startIdx = (salarySlipsPage - 1) * salarySlipsPerPage;
    const endIdx = Math.min(startIdx + salarySlipsPerPage, filtered.length);
    const pageData = filtered.slice(startIdx, endIdx);

    // Update pagination UI
    if (pageEl) pageEl.textContent = `Page ${salarySlipsPage} of ${totalPages}`;
    if (infoEl) infoEl.textContent = `${filtered.length} total`;
    if (prevBtn) prevBtn.disabled = salarySlipsPage <= 1;
    if (nextBtn) nextBtn.disabled = salarySlipsPage >= totalPages;

    let html = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Employee</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left">Period</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:center">Type</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Gross Pay</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Deductions</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right">Net Pay</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:center">Status</th>
            <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    pageData.forEach(slip => {
      const emp = slip.employees || {};
      const statusClass = slip.status === 'Approved' ? 'background:#d1fae5;color:#065f46' :
                         slip.status === 'Rejected' ? 'background:#fee2e2;color:#991b1b' :
                         'background:#fef3c7;color:#92400e';
      const periodType = slip.period_type || 'weekly';
      const periodTypeLabel = periodType === 'monthly' ? 'Monthly' : 'Weekly';
      const periodTypeColor = periodType === 'monthly' ? 'background:#dbeafe;color:#1e40af' : 'background:#f3e8ff;color:#6b21a8';
      html += `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb">${emp.name || slip.employee_id}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb">${slip.week_start} to ${slip.week_end}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;${periodTypeColor}">${periodTypeLabel}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right">${db.formatCurrency(slip.gross_pay)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#ef4444">-${db.formatCurrency(slip.total_deductions)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#10b981">${db.formatCurrency(slip.net_pay)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;${statusClass}">${slip.status}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">
            ${slip.status === 'Pending' ? `
              <button onclick="reviewAttendanceForPayslip('${slip.id}')" style="background:#3b82f6;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:4px">Review</button>
              <button onclick="approvePayslip('${slip.id}')" style="background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:4px">Approve</button>
              <button onclick="rejectPayslip('${slip.id}')" style="background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer">Reject</button>
            ` : `<button onclick="reviewAttendanceForPayslip('${slip.id}')" style="background:#6b7280;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer">View</button>`}
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
      renderSidePayslipList();
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
      renderSidePayslipList();
    } catch (err) {
      console.error('Error rejecting payslip:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to reject payslip');
    }
  };

  // Review attendance before approving payslip
  let currentReviewPayslipId = null;

  window.reviewAttendanceForPayslip = async function(payslipId) {
    const payslip = payslips.find(p => p.id === payslipId);
    if (!payslip) {
      toastError('Payslip not found');
      return;
    }

    currentReviewPayslipId = payslipId;
    const emp = employees.find(e => e.id === payslip.employee_id) || payslip.employees || {};
    const weekStart = payslip.week_start;
    const weekEnd = payslip.week_end;

    // Show modal
    const modal = document.getElementById('attendanceReviewModal');
    const title = document.getElementById('attendanceReviewTitle');
    const info = document.getElementById('attendanceReviewInfo');
    const content = document.getElementById('attendanceReviewContent');
    const summary = document.getElementById('attendanceReviewSummary');
    const actions = document.getElementById('attendanceReviewActions');

    if (!modal) return;

    title.textContent = `Attendance Review - ${emp.name || payslip.employee_id}`;
    info.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
        <div><span style="color:#6b7280;font-size:12px">Employee</span><br><strong>${emp.name || 'Unknown'}</strong></div>
        <div><span style="color:#6b7280;font-size:12px">Employee ID</span><br><strong>${payslip.employee_id}</strong></div>
        <div><span style="color:#6b7280;font-size:12px">Pay Period</span><br><strong>${weekStart} to ${weekEnd}</strong></div>
        <div><span style="color:#6b7280;font-size:12px">Days Worked</span><br><strong>${payslip.days_worked || 0}</strong></div>
        <div><span style="color:#6b7280;font-size:12px">Status</span><br><strong style="color:${payslip.status === 'Approved' ? '#10b981' : payslip.status === 'Rejected' ? '#ef4444' : '#f59e0b'}">${payslip.status || 'Pending'}</strong></div>
      </div>
    `;
    content.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280">Loading attendance records...</div>';
    modal.style.display = 'flex';

    try {
      // Fetch attendance for this employee and week
      const { data: attendanceData, error } = await supabaseClient
        .from('attendance')
        .select('*')
        .eq('employee_id', payslip.employee_id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true });

      if (error) throw error;

      const attendanceRecords = attendanceData || [];

      // Helper function to format time nicely
      function formatTimeDisplay(timeStr) {
        if (!timeStr || timeStr === '—') return '—';
        try {
          // Handle ISO format (2025-12-16T09:38:13.227+00:00)
          if (timeStr.includes('T')) {
            const date = new Date(timeStr);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          }
          // Handle simple time format (09:38 or 09:38:13)
          if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            let hours = parseInt(parts[0], 10);
            const mins = parts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${mins} ${ampm}`;
          }
          return timeStr;
        } catch (e) {
          return timeStr;
        }
      }

      if (attendanceRecords.length === 0) {
        content.innerHTML = `
          <div style="text-align:center;padding:30px;color:#6b7280;background:#fef3c7;border-radius:8px">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom:12px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style="margin:0;font-weight:600;color:#92400e">No attendance records found for this week</p>
            <p style="margin:8px 0 0;font-size:13px;color:#a16207">This employee has no clock-in/out entries for ${weekStart} to ${weekEnd}</p>
          </div>
        `;
      } else {
        // Build attendance table
        let tableHTML = `
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e5e7eb">Date</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e5e7eb">Time In</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e5e7eb">Time Out</th>
                <th style="padding:10px;text-align:right;border-bottom:2px solid #e5e7eb">Hours</th>
                <th style="padding:10px;text-align:right;border-bottom:2px solid #e5e7eb">Late</th>
              </tr>
            </thead>
            <tbody>
        `;

        let totalHours = 0;
        let totalLate = 0;

        attendanceRecords.forEach(record => {
          const date = new Date(record.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const hours = Number(record.worked_hours) || 0;
          const late = Number(record.late_minutes) || 0;
          totalHours += hours;
          totalLate += late;

          // Format late display
          let lateDisplay = '—';
          if (late > 0) {
            if (late >= 60) {
              lateDisplay = `${Math.floor(late/60)}h ${late%60}m`;
            } else {
              lateDisplay = `${late}m`;
            }
          }
          const lateColor = late > 0 ? '#ef4444' : '#10b981';

          // Format time in/out nicely
          const timeInDisplay = formatTimeDisplay(record.time_in);
          const timeOutDisplay = formatTimeDisplay(record.time_out);

          tableHTML += `
            <tr>
              <td style="padding:10px;border-bottom:1px solid #e5e7eb"><strong>${dayName}</strong> ${dateStr}</td>
              <td style="padding:10px;text-align:center;border-bottom:1px solid #e5e7eb">${timeInDisplay}</td>
              <td style="padding:10px;text-align:center;border-bottom:1px solid #e5e7eb">${timeOutDisplay}</td>
              <td style="padding:10px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:600">${hours.toFixed(1)}h</td>
              <td style="padding:10px;text-align:right;border-bottom:1px solid #e5e7eb;color:${lateColor}">${lateDisplay}</td>
            </tr>
          `;
        });

        // Add total row
        let totalLateDisplay = '—';
        if (totalLate > 0) {
          if (totalLate >= 60) {
            totalLateDisplay = `${Math.floor(totalLate/60)}h ${totalLate%60}m`;
          } else {
            totalLateDisplay = `${totalLate}m`;
          }
        }

        tableHTML += `
            <tr style="background:#f3f4f6;font-weight:600">
              <td style="padding:10px;border-top:2px solid #e5e7eb" colspan="3">Total (${attendanceRecords.length} day${attendanceRecords.length > 1 ? 's' : ''})</td>
              <td style="padding:10px;text-align:right;border-top:2px solid #e5e7eb">${totalHours.toFixed(1)}h</td>
              <td style="padding:10px;text-align:right;border-top:2px solid #e5e7eb;color:${totalLate > 0 ? '#ef4444' : '#10b981'}">${totalLateDisplay}</td>
            </tr>
          </tbody></table>`;
        content.innerHTML = tableHTML;
      }

      // Summary section - Admin sees actual data, receipt shows simplified
      const daysWorked = Number(payslip.days_worked) || 0;
      const lateDeduction = Number(payslip.late_deduction) || 0;
      const lateMinutes = Number(payslip.late_minutes) || 0;

      // Admin calculation (actual)
      const dailyRate = 510;
      const actualGross = daysWorked * dailyRate;
      const FIXED_DEDUCTIONS = 750;
      const actualNet = actualGross - FIXED_DEDUCTIONS - lateDeduction;

      // Format late minutes nicely for admin view
      let lateDisplay = '0m';
      if (lateMinutes > 0) {
        if (lateMinutes >= 60) {
          lateDisplay = `${Math.floor(lateMinutes/60)}h ${lateMinutes%60}m`;
        } else {
          lateDisplay = `${lateMinutes}m`;
        }
      }

      summary.innerHTML = `
        <div style="margin-bottom:8px;font-size:12px;font-weight:600;text-transform:uppercase;opacity:0.7">Payslip Summary (Monthly)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="opacity:0.8">Days Worked</span><span style="font-weight:600">${daysWorked}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="opacity:0.8">Late</span><span style="font-weight:600;color:${lateMinutes > 0 ? '#fca5a5' : '#6ee7b7'}">${lateDisplay}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="opacity:0.8">Late (₱)</span><span style="color:#fca5a5">₱${lateDeduction.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="opacity:0.8">Gross</span><span style="font-weight:600">₱${actualGross.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="opacity:0.8">Fixed Ded.</span><span style="color:#fca5a5">-₱${FIXED_DEDUCTIONS.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:2px solid rgba(255,255,255,0.3);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:16px;font-weight:600">NET PAY</span>
          <span style="font-size:24px;font-weight:700;color:#10b981">₱${Math.max(0, actualNet).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;opacity:0.7">Receipt shows: 6 days, Late ₱${lateDeduction.toFixed(2)}</div>
      `;

      // Actions based on status
      if (payslip.status === 'Pending') {
        actions.innerHTML = `
          <button onclick="downloadPayslipFromReview()" style="background:#6b7280;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600">Download Receipt</button>
          <button onclick="approveFromReview()" style="background:#10b981;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600">Approve Payslip</button>
          <button onclick="rejectFromReview()" style="background:#ef4444;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600">Reject</button>
        `;
      } else {
        actions.innerHTML = `
          <button onclick="downloadPayslipFromReview()" style="background:#10b981;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600">Download Receipt</button>
        `;
      }

    } catch (err) {
      console.error('Error fetching attendance:', err);
      content.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">Failed to load attendance records</div>`;
    }
  };

  // Approve from review modal
  window.approveFromReview = async function() {
    if (!currentReviewPayslipId) return;
    await approvePayslip(currentReviewPayslipId);
    document.getElementById('attendanceReviewModal').style.display = 'none';
  };

  // Reject from review modal
  window.rejectFromReview = async function() {
    if (!currentReviewPayslipId) return;
    await rejectPayslip(currentReviewPayslipId);
    document.getElementById('attendanceReviewModal').style.display = 'none';
  };

  // Download payslip from review modal
  window.downloadPayslipFromReview = function() {
    if (!currentReviewPayslipId) return;
    const payslip = payslips.find(p => p.id === currentReviewPayslipId);
    if (!payslip) return;

    const emp = employees.find(e => e.id === payslip.employee_id) || payslip.employees || {};
    currentViewPayslip = payslip;
    currentViewEmployee = emp;
    downloadPayslipReceipt();
  };

  // =============================================
  // PAYROLL (Monthly Only)
  // =============================================

  function renderPayroll() {
    const employeeSelect = document.getElementById('payrollInlineEmployeeSelect');
    const monthSelect = document.getElementById('payrollInlineMonthSelect');

    if (!employeeSelect || !monthSelect) return;

    // Populate employee dropdown
    employeeSelect.innerHTML = '<option value="">Select Employee</option>';
    employees.forEach(emp => {
      employeeSelect.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.id})</option>`;
    });

    // Populate month dropdown (last 6 months)
    monthSelect.innerHTML = '';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = formatDateLocal(date);
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      const isCurrent = i === 0 ? ' (Current)' : '';
      monthSelect.innerHTML += `<option value="${monthStart}">${label}${isCurrent}</option>`;
    }

    // Reset calculation display
    resetPayrollCalculation();

    // Setup event listeners if not already setup
    if (!employeeSelect.dataset.listenersAttached) {
      employeeSelect.addEventListener('change', () => calculatePayroll(true));
      monthSelect.addEventListener('change', () => calculatePayroll(true));

      const lateHoursInput = document.getElementById('payrollInlineLateHours');
      const lateMinutesInput = document.getElementById('payrollInlineLateMinutes');
      if (lateHoursInput) lateHoursInput.addEventListener('input', () => calculatePayroll(false));
      if (lateMinutesInput) lateMinutesInput.addEventListener('input', () => calculatePayroll(false));

      const confirmBtn = document.getElementById('payrollInlineConfirm');
      const cancelBtn = document.getElementById('payrollInlineCancel');
      if (confirmBtn) confirmBtn.addEventListener('click', handlePayrollConfirm);
      if (cancelBtn) cancelBtn.addEventListener('click', resetPayrollCalculation);

      employeeSelect.dataset.listenersAttached = 'true';
    }
  }

  // Helper to format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
  function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getPayrollWeekStart(offsetWeeks = 0) {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + (offsetWeeks * 7));
    return formatDateLocal(monday);
  }

  function getPayrollWeekEnd(weekStart) {
    const [year, month, day] = weekStart.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + 6); // Sunday
    return formatDateLocal(d);
  }

  function formatPayrollWeek(start, end) {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[sm - 1]} ${sd} - ${months[em - 1]} ${ed}`;
  }

  function getMonthEnd(monthStart) {
    const [year, month] = monthStart.split('-').map(Number);
    const lastDay = new Date(year, month, 0); // Day 0 of next month = last day of current month
    return formatDateLocal(lastDay);
  }

  function getWorkingDaysInMonth(monthStart) {
    const [year, month] = monthStart.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0) count++; // Exclude Sundays (0), count Mon-Sat
    }
    return count;
  }

  function resetPayrollCalculation() {
    const els = {
      days: document.getElementById('payrollInlineDays'),
      gross: document.getElementById('payrollInlineGross'),
      stat: document.getElementById('payrollInlineStat'),
      net: document.getElementById('payrollInlineNet'),
      notice: document.getElementById('payrollInlineNotice'),
      lateDeduction: document.getElementById('payrollInlineLateDeduction'),
      lateHours: document.getElementById('payrollInlineLateHours'),
      lateMinutes: document.getElementById('payrollInlineLateMinutes')
    };

    if (els.days) els.days.textContent = '0';
    if (els.gross) els.gross.textContent = '₱0.00';
    if (els.stat) els.stat.textContent = '₱0.00';
    if (els.net) els.net.textContent = '₱0.00';
    if (els.notice) els.notice.textContent = '';
    if (els.lateDeduction) els.lateDeduction.textContent = '₱0.00';
    if (els.lateHours) els.lateHours.value = '0';
    if (els.lateMinutes) els.lateMinutes.value = '0';
  }

  function calculatePayroll(autoPopulateLate = true) {
    const employeeSelect = document.getElementById('payrollInlineEmployeeSelect');
    const monthSelect = document.getElementById('payrollInlineMonthSelect');
    const employeeId = employeeSelect?.value;
    const periodStart = monthSelect?.value;

    if (!employeeId || !periodStart) {
      resetPayrollCalculation();
      return;
    }

    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    // Get period end (monthly only)
    const periodEnd = getMonthEnd(periodStart);

    // Max days for the month (Mon-Sat, exclude Sundays)
    const maxDaysInPeriod = getWorkingDaysInMonth(periodStart);

    // Get attendance for this employee for this period
    const periodAttendance = attendance.filter(a => {
      return String(a.employee_id) === String(employeeId) &&
             a.date >= periodStart &&
             a.date <= periodEnd;
    });

    // Get attendance dates for overlap checking
    const attendanceDates = new Set(periodAttendance.map(a => a.date));

    // Count approved leave days within this period (excluding days with attendance to prevent double-counting)
    const approvedLeaveDays = leaveRequests.filter(leave => {
      if (String(leave.employee_id) !== String(employeeId) || leave.status !== 'Approved') return false;
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      return leaveStart <= periodEndDate && leaveEnd >= periodStartDate;
    }).reduce((total, leave) => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      const effectiveStart = leaveStart < periodStartDate ? periodStartDate : leaveStart;
      const effectiveEnd = leaveEnd > periodEndDate ? periodEndDate : leaveEnd;

      // Count leave days that DON'T overlap with attendance (prevent double-counting)
      let leaveDaysCount = 0;
      for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateLocal(d);
        if (!attendanceDates.has(dateStr)) {
          leaveDaysCount++;
        }
      }
      return total + leaveDaysCount;
    }, 0);

    // Calculate days worked
    const attendanceDays = periodAttendance.length;
    const totalLateMinutes = periodAttendance.reduce((sum, a) => sum + (a.late_minutes || 0), 0);

    // Total payable days (capped at max days for period)
    const daysWorked = Math.min(attendanceDays + approvedLeaveDays, maxDaysInPeriod);

    // Calculate gross pay: Daily Rate × No. of Days
    const dailyRate = emp.salary || 510;
    const usingDefaultRate = !emp.salary;
    const grossPay = daysWorked * dailyRate;

    // Get statutory deductions (EE - Employee contributions, monthly values)
    const sss = emp.sss_deduction || 300;
    const philhealth = emp.philhealth_deduction || 250;
    const pagibig = emp.pagibig_deduction || 200;
    const statutoryDeductions = sss + philhealth + pagibig;

    // Get late input elements
    const lateHoursInput = document.getElementById('payrollInlineLateHours');
    const lateMinutesInput = document.getElementById('payrollInlineLateMinutes');

    // Auto-populate late hours/minutes from attendance data when employee/month changes
    if (autoPopulateLate) {
      const attendanceLateHours = Math.floor(totalLateMinutes / 60);
      const attendanceLateMinutes = totalLateMinutes % 60;
      if (lateHoursInput) lateHoursInput.value = attendanceLateHours;
      if (lateMinutesInput) lateMinutesInput.value = attendanceLateMinutes;
    }

    // Use the current input values for calculation (allows manual override)
    let lateHours = parseFloat(lateHoursInput?.value) || 0;
    let lateMinutes = parseFloat(lateMinutesInput?.value) || 0;

    // Clamp to non-negative and max reasonable values
    lateHours = Math.max(0, Math.min(lateHours, 200)); // ~25 days * 8 hours
    lateMinutes = Math.max(0, Math.min(lateMinutes, 59));

    // Update inputs if they were clamped
    if (lateHoursInput && parseFloat(lateHoursInput.value) !== lateHours) lateHoursInput.value = lateHours;
    if (lateMinutesInput && parseFloat(lateMinutesInput.value) !== lateMinutes) lateMinutesInput.value = lateMinutes;

    const totalLateMins = (lateHours * 60) + lateMinutes;

    // Late deduction (hourly rate = daily rate / 8)
    const hourlyRate = dailyRate / 8;
    const lateDeduction = (totalLateMins / 60) * hourlyRate;

    // Fixed deductions: SSS 300 + PhilHealth 250 + Pag-IBIG 200 = 750
    const FIXED_DEDUCTIONS = 750;
    const totalDeductions = FIXED_DEDUCTIONS + lateDeduction;

    // Net pay: Gross - Total Deductions
    const netPay = grossPay - totalDeductions;

    // Update display
    const els = {
      days: document.getElementById('payrollInlineDays'),
      gross: document.getElementById('payrollInlineGross'),
      stat: document.getElementById('payrollInlineStat'),
      net: document.getElementById('payrollInlineNet'),
      notice: document.getElementById('payrollInlineNotice'),
      lateDeduction: document.getElementById('payrollInlineLateDeduction')
    };

    // Show days breakdown (attendance + leave)
    const daysDisplay = approvedLeaveDays > 0
      ? `${daysWorked} (${attendanceDays} work + ${approvedLeaveDays} leave)`
      : `${daysWorked}`;
    if (els.days) els.days.textContent = daysDisplay;
    if (els.gross) els.gross.textContent = db.formatCurrency(grossPay);
    if (els.stat) els.stat.textContent = db.formatCurrency(totalDeductions);
    if (els.net) els.net.textContent = db.formatCurrency(Math.max(0, netPay));
    if (els.lateDeduction) els.lateDeduction.textContent = db.formatCurrency(lateDeduction);

    // Check for warnings
    let notice = '';
    let canRunPayroll = true;

    // Salary warning is important - always show if using default rate
    if (usingDefaultRate) {
      notice = `⚠️ No salary set - using default ₱510/day. `;
    }

    const existingPayslip = payslips.find(p => String(p.employee_id) === String(employeeId) && p.week_start === periodStart);
    if (existingPayslip) {
      if (existingPayslip.status === 'Approved') {
        notice += `Payslip already APPROVED for this month. Cannot modify.`;
        canRunPayroll = false;
      } else {
        notice += `Payslip exists (${existingPayslip.status}). Will update.`;
      }
    } else if (daysWorked === 0) {
      notice += `No attendance or leave found. Gross pay will be ₱0.00.`;
    }
    // Warning for negative net pay
    if (netPay < 0 && daysWorked > 0) {
      notice = `⚠️ Deductions exceed gross pay. Net pay will be ₱0.00.`;
      if (usingDefaultRate) notice = `⚠️ No salary set (using ₱510/day). ` + notice;
    }
    if (els.notice) {
      els.notice.textContent = notice;
      els.notice.style.color = (netPay < 0 || !canRunPayroll || usingDefaultRate) ? '#dc2626' : '#6b7280';
    }

    // Disable/enable confirm button based on whether payroll can be run
    const confirmBtn = document.getElementById('payrollInlineConfirm');
    if (confirmBtn) {
      confirmBtn.disabled = !canRunPayroll;
      confirmBtn.style.opacity = canRunPayroll ? '1' : '0.5';
      confirmBtn.style.cursor = canRunPayroll ? 'pointer' : 'not-allowed';
    }

    // Store calculation data for confirmation
    // Fixed deductions: SSS 300, PhilHealth 250, Pag-IBIG 200
    window._payrollData = {
      employeeId,
      weekStart: periodStart,
      weekEnd: periodEnd,
      periodType: 'monthly',
      grossPay,
      sss: daysWorked > 0 ? 300 : 0,
      philhealth: daysWorked > 0 ? 250 : 0,
      pagibig: daysWorked > 0 ? 200 : 0,
      lateDeduction: daysWorked > 0 ? lateDeduction : 0,
      totalDeductions: daysWorked > 0 ? totalDeductions : 0,
      netPay: daysWorked > 0 ? Math.max(0, netPay) : 0,
      lateMinutes: totalLateMins,
      daysWorked
    };
  }

  async function handlePayrollConfirm() {
    const data = window._payrollData;
    if (!data || !data.employeeId) {
      if (window.toastError) toastError('Error', 'Please select an employee and month first');
      return;
    }

    // FRESH DATABASE CHECK: Prevent race conditions and check approved status
    try {
      const { data: freshPayslips, error: checkError } = await supabaseClient
        .from('payslips')
        .select('id, status, period_type')
        .eq('employee_id', data.employeeId)
        .eq('week_start', data.weekStart);

      if (checkError) throw checkError;

      // Check for approved payslip
      const approvedPayslip = freshPayslips?.find(p => p.status === 'Approved');
      if (approvedPayslip) {
        if (window.toastError) toastError('Error', 'Cannot modify an approved payslip. Please reject it first if changes are needed.');
        return;
      }
    } catch (err) {
      console.error('Error checking existing payslips:', err);
      // Continue anyway if check fails, upsert will handle conflicts
    }

    // Warn if no days worked
    if (data.daysWorked === 0) {
      if (!confirm(`No attendance or approved leave found for this month. This will create a payslip with ₱0.00 gross pay. Continue?`)) {
        return;
      }
    }

    try {
      await db.upsertPayslip(data);
      if (window.toastSuccess) toastSuccess('Success', 'Monthly payroll generated successfully');

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

    const today = formatDateLocal(new Date());
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
      html += `<tr><td colspan="7" style="padding:24px;text-align:center;color:#4b5563">No employees found</td></tr>`;
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
          // Show both Time Out and Cancel buttons when working
          actionBtn = `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="clockOut('${emp.id}')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">Time Out</button>
              <button onclick="cancelTimeIn('${emp.id}')" style="background:#6b7280;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px" title="Cancel mistaken time in">Cancel</button>
            </div>`;
        } else {
          actionBtn = `<span style="color:#4b5563">Done for today</span>`;
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

  // Clock In function (First In, Last Out rule - preserves first time_in)
  window.clockIn = async function(employeeId) {
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Employee not found');

      // Check if already clocked in today
      const todayAtt = attendance.find(a => {
        const today = new Date().toISOString().split('T')[0];
        return a.employee_id === employeeId && a.date === today;
      });

      await db.timeIn(employeeId, emp.name, emp.role);

      if (todayAtt && todayAtt.time_in) {
        // Already clocked in - First In preserved
        if (window.toastInfo) toastInfo('Info', `${emp.name} already clocked in (First In preserved)`);
      } else {
        if (window.toastSuccess) toastSuccess('Success', `${emp.name} clocked in`);
      }

      await loadAllData();
      renderTimeClock();
      renderAttendance();
      updateHomeStats();
    } catch (err) {
      console.error('Clock in error:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to clock in');
    }
  };

  // Clock Out function (Last Out rule - always updates to latest time_out)
  window.clockOut = async function(employeeId) {
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Employee not found');

      // Check if already clocked out today
      const todayAtt = attendance.find(a => {
        const today = new Date().toISOString().split('T')[0];
        return a.employee_id === employeeId && a.date === today;
      });

      await db.timeOut(employeeId);

      if (todayAtt && todayAtt.time_out) {
        // Already clocked out - Last Out updated
        if (window.toastSuccess) toastSuccess('Success', `${emp.name} clocked out (Last Out updated)`);
      } else {
        if (window.toastSuccess) toastSuccess('Success', `${emp.name} clocked out`);
      }

      await loadAllData();
      renderTimeClock();
      renderAttendance();
      updateHomeStats();
    } catch (err) {
      console.error('Clock out error:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to clock out');
    }
  };

  // Cancel Time In function (for mistaken clock-ins)
  window.cancelTimeIn = async function(employeeId) {
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Employee not found');

      // Confirm before cancelling
      if (!confirm(`Cancel time in for ${emp.name}? This will remove today's attendance record.`)) {
        return;
      }

      await db.cancelTimeIn(employeeId);
      if (window.toastSuccess) toastSuccess('Success', `Time in cancelled for ${emp.name}`);

      await loadAllData();
      renderTimeClock();
      renderAttendance();
      updateHomeStats();
    } catch (err) {
      console.error('Cancel time in error:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to cancel time in');
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
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday (same as payroll)
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
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
    const newEmployeeFields = document.getElementById('newEmployeeFields');
    const empIdField = document.getElementById('empId');

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
        // Hide new employee fields and show ID when editing
        newEmployeeFields.style.display = 'none';
        empIdField.parentElement.style.display = '';
      }
    } else {
      els.modalTitle.textContent = 'Add Employee';
      els.form.reset();
      // Show new employee fields and hide ID when adding
      newEmployeeFields.style.display = 'block';
      empIdField.parentElement.style.display = 'none';
      // Set default values
      document.getElementById('empSalary').value = 510;
      document.getElementById('empSSS').value = 300;
      document.getElementById('empPhilhealth').value = 250;
      document.getElementById('empPagibig').value = 200;
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
    // Allow 0 as valid value (don't use || which treats 0 as falsy)
    const salaryInput = parseFloat(document.getElementById('empSalary').value);
    const salary = !isNaN(salaryInput) ? salaryInput : 510; // Daily rate
    const sssInput = parseFloat(document.getElementById('empSSS').value);
    const sss = !isNaN(sssInput) ? sssInput : 300;
    const philhealthInput = parseFloat(document.getElementById('empPhilhealth').value);
    const philhealth = !isNaN(philhealthInput) ? philhealthInput : 250;
    const pagibigInput = parseFloat(document.getElementById('empPagibig').value);
    const pagibig = !isNaN(pagibigInput) ? pagibigInput : 200;

    // Validate required fields
    if (!name) {
      if (window.toastError) toastError('Error', 'Full name is required');
      return;
    }
    if (!role) {
      if (window.toastError) toastError('Error', 'Please select a role');
      return;
    }

    // Validate deduction bounds
    if (sss < 0 || sss > 5000) {
      if (window.toastError) toastError('Error', 'SSS deduction must be between ₱0 and ₱5,000');
      return;
    }
    if (philhealth < 0 || philhealth > 5000) {
      if (window.toastError) toastError('Error', 'PhilHealth deduction must be between ₱0 and ₱5,000');
      return;
    }
    if (pagibig < 0 || pagibig > 1000) {
      if (window.toastError) toastError('Error', 'Pag-IBIG deduction must be between ₱0 and ₱1,000');
      return;
    }
    if (salary < 0) {
      if (window.toastError) toastError('Error', 'Daily rate cannot be negative');
      return;
    }

    // Warn if total deductions seem too high relative to weekly salary
    const weeklyGross = salary * 6; // Daily rate × 6 days
    const totalDeductions = sss + philhealth + pagibig;
    if (totalDeductions > weeklyGross * 0.5) {
      if (!confirm(`Warning: Total statutory deductions (₱${totalDeductions.toLocaleString()}) exceed 50% of weekly gross (₱${weeklyGross.toFixed(2)}). Continue anyway?`)) {
        return;
      }
    }

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
        // Create new employee
        const email = document.getElementById('empEmail').value.trim().toLowerCase();
        const username = document.getElementById('empUsername').value.trim().toLowerCase();
        const password = document.getElementById('empPassword').value;

        // Validate required fields for new employee
        if (!email || !username || !password) {
          if (window.toastError) toastError('Error', 'Email, username, and password are required');
          return;
        }
        if (password.length < 6) {
          if (window.toastError) toastError('Error', 'Password must be at least 6 characters');
          return;
        }

        // Check if email already exists
        const { data: emailCheck } = await supabaseClient
          .from('employees')
          .select('id')
          .eq('email', email)
          .single();

        if (emailCheck) {
          if (window.toastError) toastError('Error', 'This email is already registered');
          return;
        }

        // Check if username already exists
        const { data: usernameCheck } = await supabaseClient
          .from('employees')
          .select('id')
          .eq('username', username)
          .single();

        if (usernameCheck) {
          if (window.toastError) toastError('Error', 'This username is already taken');
          return;
        }

        // Generate unique employee ID
        const employeeId = await db.generateEmployeeId();

        // Create employee in Supabase
        const { error } = await supabaseClient
          .from('employees')
          .insert([{
            id: employeeId,
            name,
            email,
            username,
            password_hash: password,
            role,
            salary,
            sss_deduction: sss,
            philhealth_deduction: philhealth,
            pagibig_deduction: pagibig,
            status: 'active'
          }]);

        if (error) throw error;

        if (window.toastSuccess) toastSuccess('Success', `Employee created with ID: ${employeeId}`);
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
  // BULK UPDATE ALL EMPLOYEES
  // =============================================
  async function handleBulkUpdate() {
    const dailyRateInput = document.getElementById('bulkDailyRate');
    const sssInput = document.getElementById('bulkSSS');
    const philHealthInput = document.getElementById('bulkPhilHealth');
    const pagIbigInput = document.getElementById('bulkPagIBIG');

    const dailyRate = dailyRateInput?.value ? parseFloat(dailyRateInput.value) : null;
    const sss = sssInput?.value ? parseFloat(sssInput.value) : null;
    const philHealth = philHealthInput?.value ? parseFloat(philHealthInput.value) : null;
    const pagIbig = pagIbigInput?.value ? parseFloat(pagIbigInput.value) : null;

    // Check if at least one field has a value
    if (dailyRate === null && sss === null && philHealth === null && pagIbig === null) {
      if (window.toastWarning) toastWarning('Warning', 'Please enter at least one value to update');
      return;
    }

    // Validate values
    if (dailyRate !== null && dailyRate < 0) {
      if (window.toastError) toastError('Error', 'Daily rate cannot be negative');
      return;
    }
    if (sss !== null && (sss < 0 || sss > 5000)) {
      if (window.toastError) toastError('Error', 'SSS must be between ₱0 and ₱5,000');
      return;
    }
    if (philHealth !== null && (philHealth < 0 || philHealth > 5000)) {
      if (window.toastError) toastError('Error', 'PhilHealth must be between ₱0 and ₱5,000');
      return;
    }
    if (pagIbig !== null && (pagIbig < 0 || pagIbig > 1000)) {
      if (window.toastError) toastError('Error', 'Pag-IBIG must be between ₱0 and ₱1,000');
      return;
    }

    // Build update summary
    const changes = [];
    if (dailyRate !== null) changes.push(`Daily Rate: ₱${dailyRate}`);
    if (sss !== null) changes.push(`SSS: ₱${sss}`);
    if (philHealth !== null) changes.push(`PhilHealth: ₱${philHealth}`);
    if (pagIbig !== null) changes.push(`Pag-IBIG: ₱${pagIbig}`);

    const confirmMsg = `This will update ALL ${employees.length} active employees with:\n\n${changes.join('\n')}\n\nAre you sure you want to continue?`;
    if (!confirm(confirmMsg)) return;

    try {
      // Build update object with only non-null values
      const updateData = {};
      if (dailyRate !== null) updateData.salary = dailyRate;
      if (sss !== null) updateData.sss_deduction = sss;
      if (philHealth !== null) updateData.philhealth_deduction = philHealth;
      if (pagIbig !== null) updateData.pagibig_deduction = pagIbig;

      // Update all employees in Supabase
      const { error } = await supabaseClient
        .from('employees')
        .update(updateData)
        .not('id', 'is', null); // Update all rows

      if (error) throw error;

      // Clear inputs
      if (dailyRateInput) dailyRateInput.value = '';
      if (sssInput) sssInput.value = '';
      if (philHealthInput) philHealthInput.value = '';
      if (pagIbigInput) pagIbigInput.value = '';

      if (window.toastSuccess) toastSuccess('Success', `Updated ${employees.length} employees successfully`);

      // Reload data and re-render
      await loadAllData();
      renderEmployees();
      updateHomeStats();

    } catch (err) {
      console.error('Error in bulk update:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to update employees');
    }
  }

  // =============================================
  // EMPLOYEE PAYSLIP HISTORY VIEW
  // =============================================
  let empPayslipSearchQuery = '';
  let currentEmpPayslips = [];

  window.viewEmployeePayslips = async function(empId, empName) {
    const modal = document.getElementById('empPayslipModal');
    const title = document.getElementById('empPayslipModalTitle');
    const tbody = document.querySelector('#empPayslipTable tbody');
    const searchInput = document.getElementById('empPayslipSearch');
    const summary = document.getElementById('empPayslipSummary');

    if (!modal || !tbody) return;

    // Set title
    if (title) title.textContent = `Payslip History - ${empName}`;

    // Reset search
    empPayslipSearchQuery = '';
    if (searchInput) searchInput.value = '';

    // Show modal
    modal.style.display = 'flex';

    // Loading state
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280">Loading payslips...</td></tr>';
    if (summary) summary.style.display = 'none';

    try {
      // Fetch payslips for this employee
      const { data, error } = await supabaseClient
        .from('payslips')
        .select('*')
        .eq('employee_id', empId)
        .order('week_start', { ascending: false });

      if (error) throw error;

      currentEmpPayslips = data || [];
      renderEmpPayslipTable();

    } catch (err) {
      console.error('Error fetching payslips:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#dc2626">Failed to load payslips</td></tr>';
    }
  };

  function renderEmpPayslipTable() {
    const tbody = document.querySelector('#empPayslipTable tbody');
    const summary = document.getElementById('empPayslipSummary');
    const countEl = document.getElementById('empPayslipCount');
    const grossEl = document.getElementById('empPayslipTotalGross');
    const netEl = document.getElementById('empPayslipTotalNet');

    if (!tbody) return;

    // Apply search filter
    let filtered = currentEmpPayslips;
    if (empPayslipSearchQuery && empPayslipSearchQuery.trim() !== '') {
      const query = empPayslipSearchQuery.toLowerCase().trim();
      filtered = currentEmpPayslips.filter(p => {
        const week = (p.week_start || '').toLowerCase();
        const status = (p.status || '').toLowerCase();
        const gross = String(Math.floor(Number(p.gross_pay)));
        const net = String(Math.floor(Number(p.net_pay)));
        return week.includes(query) || status.includes(query) || gross.includes(query) || net.includes(query);
      });
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      const msg = empPayslipSearchQuery ? 'No payslips matching your search' : 'No payslips found for this employee';
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280">${msg}</td></tr>`;
      if (summary) summary.style.display = 'none';
      return;
    }

    // Calculate totals
    let totalGross = 0;
    let totalNet = 0;

    filtered.forEach((p, idx) => {
      const gross = Number(p.gross_pay) || 0;
      const net = Number(p.net_pay) || 0;
      const deductions = Number(p.total_deductions) || (gross - net);
      totalGross += gross;
      totalNet += net;

      const statusClass = p.status === 'Approved' ? 'badge-success' :
                         p.status === 'Rejected' ? 'badge-error' : 'badge-warning';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.week_start || '—'}</td>
        <td>₱${gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td style="color:#dc2626">-₱${deductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td style="color:#059669;font-weight:600">₱${net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td><span class="badge ${statusClass}">${p.status || 'Pending'}</span></td>
        <td><button class="secondary" onclick="viewPaystubDetail('${p.id}')" style="padding:4px 10px;font-size:12px">View</button></td>
      `;
      tbody.appendChild(tr);
    });

    // Show summary
    if (summary) {
      summary.style.display = 'block';
      if (countEl) countEl.textContent = filtered.length;
      if (grossEl) grossEl.textContent = '₱' + totalGross.toLocaleString(undefined, {minimumFractionDigits: 2});
      if (netEl) netEl.textContent = '₱' + totalNet.toLocaleString(undefined, {minimumFractionDigits: 2});
    }
  }

  // View paystub detail
  let currentViewEmployee = null;
  let currentViewPayslip = null;

  window.viewPaystubDetail = function(payslipId) {
    const payslip = currentEmpPayslips.find(p => p.id === payslipId);
    if (!payslip) return;

    // Get employee info
    const emp = employees.find(e => e.id === payslip.employee_id) || {};

    // Store for download/print
    currentViewPayslip = payslip;
    currentViewEmployee = emp;

    const content = document.getElementById('paystubContent');
    if (content) {
      const gross = Number(payslip.gross_pay) || 0;
      const net = Number(payslip.net_pay) || 0;
      const sss = Number(payslip.sss) || 0;
      const philhealth = Number(payslip.philhealth) || 0;
      const pagibig = Number(payslip.pagibig) || 0;
      const lateDeduction = Number(payslip.late_deduction) || 0;

      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div class="muted" style="font-size:12px;color:#6b7280">Employee</div>
            <div style="font-weight:600">${emp.name || 'Unknown'}</div>
          </div>
          <div>
            <div class="muted" style="font-size:12px;color:#6b7280">Employee ID</div>
            <div style="font-weight:600">${payslip.employee_id}</div>
          </div>
          <div>
            <div class="muted" style="font-size:12px;color:#6b7280">Period</div>
            <div style="font-weight:600">${payslip.week_start || '—'} to ${payslip.week_end || '—'}</div>
          </div>
          <div>
            <div class="muted" style="font-size:12px;color:#6b7280">Status</div>
            <div style="font-weight:600">${payslip.status || 'Pending'}</div>
          </div>
        </div>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px">
          <div>Gross Pay:</div>
          <div style="text-align:right;font-weight:600">₱${gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>SSS:</div>
          <div style="text-align:right;color:#ef4444">-₱${sss.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>PhilHealth:</div>
          <div style="text-align:right;color:#ef4444">-₱${philhealth.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Pag-IBIG:</div>
          <div style="text-align:right;color:#ef4444">-₱${pagibig.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Late Deduction:</div>
          <div style="text-align:right;color:#ef4444">-₱${lateDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700">
          <span>Net Pay:</span>
          <span style="color:#10b981">₱${net.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
      `;
    }

    const modal = document.getElementById('paystubModal');
    if (modal) modal.style.display = 'flex';
  };

  // Generate receipt HTML content (Simple Peso Receipt - Client's final format)
  function generateReceiptHTML(payslip, emp) {
    const dailyRate = 510; // Fixed rate
    const lateDeduction = Number(payslip.late_deduction) || 0;

    // Client's formula:
    // No. of Days: 6 (hardcoded)
    // Late: shown in Pesos only
    // Gross = (6 × 510) - Late
    // Net = Gross - 750
    const RECEIPT_DAYS = 6;
    const receiptGross = (RECEIPT_DAYS * dailyRate) - lateDeduction;
    const FIXED_DEDUCTIONS = 750;
    const receiptNet = Math.max(0, receiptGross - FIXED_DEDUCTIONS);

    // Format period
    const startDate = new Date(payslip.week_start);
    const endDate = new Date(payslip.week_end);
    const periodLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Payslip Receipt - ${emp.name || 'Employee'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            padding: 30px;
            max-width: 350px;
            margin: 0 auto;
            background: #fff;
            color: #1f2937;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .period {
            font-size: 11px;
            color: #6b7280;
          }
          .employee-info {
            text-align: center;
            margin-bottom: 20px;
          }
          .emp-name {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .emp-id {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 2px;
          }
          .rate {
            font-size: 11px;
            color: #6b7280;
          }
          .body-section {
            margin-bottom: 16px;
          }
          .row {
            display: grid;
            grid-template-columns: 1fr 40px 80px;
            padding: 6px 0;
            font-size: 12px;
          }
          .row-label { text-align: left; }
          .row-value { text-align: right; }
          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: 600;
            font-size: 13px;
            padding: 6px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 10px;
            color: #9ca3af;
          }
          .signature-line {
            margin-bottom: 8px;
          }
          @media print {
            body { padding: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PAYROLL - PAYSLIP (Monthly)</div>
          <div class="period">Period: ${periodLabel}</div>
        </div>

        <div class="employee-info">
          <div class="emp-name">${emp.name || 'Unknown'}</div>
          <div class="emp-id">${payslip.employee_id}</div>
          <div class="rate">Rate/day: P${dailyRate.toFixed(2)}</div>
        </div>

        <div class="body-section">
          <div class="row">
            <span class="row-label">No. of Days</span>
            <span class="row-value">${RECEIPT_DAYS}</span>
            <span class="row-value">P${(RECEIPT_DAYS * dailyRate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div class="row">
            <span class="row-label">Late</span>
            <span class="row-value"></span>
            <span class="row-value">P${lateDeduction.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          
          <div style="margin-top:12px;font-weight:600;font-size:12px">Less:</div>
          <div style="display:grid;grid-template-columns:1fr 60px 60px;gap:2px;margin-top:6px;font-size:11px">
            <div></div>
            <div style="text-align:center;font-weight:600;text-decoration:underline">EE</div>
            <div style="text-align:center;font-weight:600;text-decoration:underline">ER</div>
            <div>SSS</div>
            <div style="text-align:center">P300</div>
            <div style="text-align:center">P610</div>
            <div>PhilHealth</div>
            <div style="text-align:center">P250</div>
            <div style="text-align:center">P250</div>
            <div>Pag-IBIG</div>
            <div style="text-align:center">P200</div>
            <div style="text-align:center">P200</div>
          </div>

          <div class="divider" style="margin-top:12px"></div>
          <div class="total-row">
            <span>Gross (monthly)</span>
            <span>P${receiptGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div class="total-row">
            <span>Net (monthly)</span>
            <span>P${receiptNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
        </div>

        <div class="footer">
          <div class="signature-line">Received by: ____________________</div>
          <div>Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </body>
      </html>
    `;
  }

  // Download payslip receipt as PDF (same format as employee portal)
  window.downloadPayslipReceipt = function() {
    if (!currentViewPayslip) {
      toastError('No payslip selected');
      return;
    }

    const emp = currentViewEmployee || {};
    const payslip = currentViewPayslip;

    // Load logo image first
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = function() {
      generatePayslipPDF(payslip, emp, logoImg);
    };
    logoImg.onerror = function() {
      // Generate PDF without logo if image fails to load
      generatePayslipPDF(payslip, emp, null);
    };
    logoImg.src = 'src/logo.png';
  };

  function generatePayslipPDF(payslip, emp, logoImg) {
    const { jsPDF } = window.jspdf;
    // Receipt size: half of A4 lengthwise (landscape-ish receipt)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [148, 210]  // width x height (A5 size - half A4)
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // Format period dates
    const startDate = new Date(payslip.week_start);
    const endDate = new Date(payslip.week_end);
    const periodLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}`;

    // Company logo (top right)
    if (logoImg) {
      try {
        doc.addImage(logoImg, 'PNG', pageWidth - 25, 12, 15, 15);
      } catch (e) {
        console.log('Could not add logo to PDF');
      }
    }

    // ============================================
    // HEADER - Centered
    // ============================================
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYROLL - PAYSLIP (Monthly)', pageWidth / 2, y, { align: 'center' });

    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${periodLabel}`, pageWidth / 2, y, { align: 'center' });

    // Employee info - centered
    y += 14;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.name || 'Unknown', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(payslip.employee_id, pageWidth / 2, y, { align: 'center' });

    // Rate per day - centered
    y += 6;
    const dailyRate = 510;
    doc.text(`Rate/day: P${dailyRate.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });

    // ============================================
    // BODY SECTION
    // ============================================
    y += 16;
    const leftMargin = 25;
    const rightMargin = pageWidth - 25;
    const contentWidth = rightMargin - leftMargin;

    // Receipt calculations
    const RECEIPT_DAYS = 6;
    const lateDeduction = Number(payslip.late_deduction) || 0;
    const receiptGross = (RECEIPT_DAYS * dailyRate) - lateDeduction;
    const FIXED_DEDUCTIONS = 750;
    const receiptNet = receiptGross - FIXED_DEDUCTIONS;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    // No. of Days with computed amount (6 × 510 = 3060)
    const daysAmount = RECEIPT_DAYS * dailyRate;
    doc.text('No. of Days', leftMargin, y);
    doc.text(`${RECEIPT_DAYS}`, leftMargin + 55, y);
    doc.text(`P${daysAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rightMargin, y, { align: 'right' });

    // Late
    y += 8;
    doc.text('Late', leftMargin, y);
    doc.text(`P${lateDeduction.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rightMargin, y, { align: 'right' });

    // ============================================
    // LESS: EE/ER BREAKDOWN
    // ============================================
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Less:', leftMargin, y);

    // Column positions for EE/ER
    const eeColX = pageWidth / 2 + 5;
    const erColX = pageWidth / 2 + 35;

    // Headers
    y += 10;
    doc.setFontSize(10);
    doc.text('EE', eeColX, y, { align: 'center' });
    doc.text('ER', erColX, y, { align: 'center' });

    // Underlines for headers
    doc.setDrawColor(100, 100, 100);
    doc.line(eeColX - 12, y + 2, eeColX + 12, y + 2);
    doc.line(erColX - 12, y + 2, erColX + 12, y + 2);

    // SSS
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text('SSS', leftMargin, y);
    doc.text('P300', eeColX, y, { align: 'center' });
    doc.text('P610', erColX, y, { align: 'center' });

    // PhilHealth
    y += 8;
    doc.text('PhilHealth', leftMargin, y);
    doc.text('P250', eeColX, y, { align: 'center' });
    doc.text('P250', erColX, y, { align: 'center' });

    // Pag-IBIG
    y += 8;
    doc.text('Pag-IBIG', leftMargin, y);
    doc.text('P200', eeColX, y, { align: 'center' });
    doc.text('P200', erColX, y, { align: 'center' });

    // ============================================
    // TOTALS
    // ============================================
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Gross (monthly)', leftMargin, y);
    doc.text(`P${receiptGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rightMargin, y, { align: 'right' });

    y += 10;
    doc.text('Net (monthly)', leftMargin, y);
    doc.text(`P${Math.max(0, receiptNet).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rightMargin, y, { align: 'right' });

    // ============================================
    // FOOTER - Centered at bottom
    // ============================================
    y = pageHeight - 35;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Received by: ____________________', pageWidth / 2, y, { align: 'center' });

    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth / 2, y, { align: 'center' });

    // Download
    doc.save(`payslip_${(emp.name || payslip.employee_id).replace(/\s+/g, '_')}_${payslip.week_start}.pdf`);
    toastSuccess('Payslip PDF downloaded successfully');
  };

  // Print payslip receipt
  window.printPayslipReceipt = function() {
    if (!currentViewPayslip) {
      toastError('No payslip selected');
      return;
    }

    const emp = currentViewEmployee || {};
    const receiptHTML = generateReceiptHTML(currentViewPayslip, emp);

    const printWindow = window.open('', '_blank', 'width=450,height=700');
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    printWindow.onload = function() {
      printWindow.print();
    };
  };

  // Close modal handlers
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeEmpPayslipModal');
    const modal = document.getElementById('empPayslipModal');
    const searchInput = document.getElementById('empPayslipSearch');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    // Close on backdrop click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    // Search functionality
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        empPayslipSearchQuery = e.target.value;
        renderEmpPayslipTable();
      });
    }

    // Paystub modal close handlers
    const paystubModal = document.getElementById('paystubModal');
    const closePaystubBtn = document.getElementById('closePaystubModal');

    if (closePaystubBtn && paystubModal) {
      closePaystubBtn.addEventListener('click', () => {
        paystubModal.style.display = 'none';
      });
    }

    if (paystubModal) {
      paystubModal.addEventListener('click', (e) => {
        if (e.target === paystubModal) paystubModal.style.display = 'none';
      });
    }
  });

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
  // SIDEBAR PAYSLIP STATUS
  // =============================================
  let sideWeekOffset = 0;

  function renderSidePayslipList() {
    const container = document.getElementById('sidePayslipList');
    const labelEl = document.getElementById('sideWeekLabel');
    if (!container) return;

    const weekStart = getOffsetWeekStart(sideWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (labelEl) {
      labelEl.textContent = formatWeekLabel(weekStart);
    }

    container.innerHTML = '';

    if (employees.length === 0) {
      container.innerHTML = '<div class="muted" style="padding:12px">No employees available</div>';
      return;
    }

    // Format date in local timezone (avoid UTC conversion issues)
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

    employees.forEach(emp => {
      const empPayslip = payslips.find(p =>
        p.employee_id === emp.id && p.week_start === weekStartStr
      );

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 8px;border-bottom:1px solid #f1f5f9;';

      const left = document.createElement('div');
      left.innerHTML = `<div style="font-weight:600;font-size:13px;color:#1f2937">${emp.name || emp.id}</div><div style="font-size:12px;color:#4b5563">${emp.id}</div>`;

      const right = document.createElement('div');
      right.style.textAlign = 'right';

      if (empPayslip) {
        const status = empPayslip.status || 'Pending';
        const badge = document.createElement('span');
        badge.textContent = status;
        badge.style.cssText = 'display:inline-block;padding:4px 10px;border-radius:12px;color:#fff;font-size:11px;font-weight:600;';
        if (status === 'Approved') badge.style.background = '#10b981';
        else if (status === 'Rejected') badge.style.background = '#ef4444';
        else badge.style.background = '#f59e0b';
        right.appendChild(badge);
      } else {
        const noPayslip = document.createElement('span');
        noPayslip.textContent = 'No payslip';
        noPayslip.style.cssText = 'font-size:11px;color:#6b7280;';
        right.appendChild(noPayslip);
      }

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  }

  // Sidebar week navigation
  document.getElementById('sideWeekPrev')?.addEventListener('click', () => {
    sideWeekOffset--;
    renderSidePayslipList();
  });

  document.getElementById('sideWeekNext')?.addEventListener('click', () => {
    sideWeekOffset++;
    renderSidePayslipList();
  });

  // Print Payslip Status (week)
  document.getElementById('printSidePayslip')?.addEventListener('click', () => {
    const weekStart = getOffsetWeekStart(sideWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekLabel = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

    // Calculate performance for each employee
    const rows = employees.map(emp => {
      const empPayslip = payslips.find(p => p.employee_id === emp.id && p.week_start === weekStartStr);
      const status = empPayslip ? empPayslip.status : 'No payslip';

      // Calculate performance
      const empAttendance = attendance.filter(a => a.employee_id === emp.id && a.date >= weekStartStr && a.date <= weekEndStr);
      const presentDays = empAttendance.length;
      const lateDays = empAttendance.filter(a => a.late_minutes > 0).length;
      const absentDays = Math.max(0, 6 - presentDays);

      let perfStatus = 'No data';
      if (presentDays === 6 && lateDays === 0) perfStatus = 'Perfect attendance';
      else if (presentDays >= 5 && lateDays <= 1) perfStatus = 'Minor lates';
      else if (lateDays >= 3) perfStatus = 'Frequently late';
      else if (presentDays < 4) perfStatus = 'Poor attendance';
      else perfStatus = 'Irregular attendance';

      return { id: emp.id, name: emp.name, status, perf: `${perfStatus} • ${presentDays}P/${lateDays}L/${absentDays}A` };
    });

    const html = `<!DOCTYPE html><html><head><title>Payslip Status ${weekLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
      th{background:#f8f9fa;font-weight:600}tr:hover{background:#f5f5f5}.footer{margin-top:20px;font-size:11px;color:#4b5563}
      @media print{body{padding:10px}}</style></head>
      <body><h1>Payslip Status ${weekLabel}</h1>
      <table><thead><tr><th>EMP ID</th><th>Name</th><th>Status</th><th>Performance (wk)</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.id}</td><td>${r.name}</td><td>${r.status}</td><td>${r.perf}</td></tr>`).join('')}
      </tbody></table>
      <div class="footer">Generated: ${new Date().toLocaleString()}</div>
      <script>window.print();</script></body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  });

  // Print Attendance Report (week)
  document.getElementById('printAttendanceReport')?.addEventListener('click', () => {
    const weekStart = getOffsetWeekStart(chartWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekLabel = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

    // Get attendance for the week
    const weekAttendance = attendance.filter(a => a.date >= weekStartStr && a.date <= weekEndStr)
      .sort((a, b) => b.date.localeCompare(a.date) || a.employee_id.localeCompare(b.employee_id));

    const rows = weekAttendance.map(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      const timeIn = a.time_in ? new Date(a.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
      const timeOut = a.time_out ? new Date(a.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
      return { date: a.date, empId: a.employee_id, name: emp?.name || a.employee_id, timeIn, timeOut, attId: a.id };
    });

    const html = `<!DOCTYPE html><html><head><title>Attendance Report ${weekLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}
      th{background:#f8f9fa;font-weight:600}tr:hover{background:#f5f5f5}.footer{margin-top:20px;font-size:11px;color:#4b5563}
      @media print{body{padding:10px}}</style></head>
      <body><h1>Attendance Report ${weekLabel}</h1>
      <table><thead><tr><th>Date</th><th>Employee ID</th><th>Name</th><th>Time In</th><th>Time Out</th><th>Attendance ID</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.date}</td><td>${r.empId}</td><td>${r.name}</td><td>${r.timeIn}</td><td>${r.timeOut}</td><td>${r.attId}</td></tr>`).join('')}
      </tbody></table>
      <div class="footer">Generated: ${new Date().toLocaleString()}</div>
      <script>window.print();</script></body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  });

  // =============================================
  // PERFORMANCE CHART
  // =============================================
  let perfWeekOffset = 0;
  let performanceChart = null;
  let perfSearchQuery = '';

  function renderPerformanceChart() {
    const canvas = document.getElementById('employeePerformanceChart');
    const labelEl = document.getElementById('perfWeekLabel');
    const summaryEl = document.getElementById('perfSummaryText');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const weekStart = getOffsetWeekStart(perfWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (labelEl) {
      labelEl.textContent = formatWeekLabel(weekStart);
    }

    const weekStartStr = formatDateLocal(weekStart);
    const weekEndStr = formatDateLocal(weekEnd);

    // Filter employees by search query
    const filteredEmployees = perfSearchQuery
      ? employees.filter(emp =>
          emp.name.toLowerCase().includes(perfSearchQuery.toLowerCase()) ||
          emp.id.toLowerCase().includes(perfSearchQuery.toLowerCase())
        )
      : employees;

    if (filteredEmployees.length === 0) {
      if (summaryEl) summaryEl.textContent = perfSearchQuery ? 'No matches' : '0% average';
      if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
      }
      return;
    }

    // Calculate performance for each employee
    const perfData = filteredEmployees.map(emp => {
      const empAttendance = attendance.filter(a =>
        a.employee_id === emp.id &&
        a.date >= weekStartStr &&
        a.date <= weekEndStr
      );

      let onTime = 0, late = 0, absent = 0;
      const expectedDays = 6; // Mon-Sat

      empAttendance.forEach(a => {
        if (a.late_minutes > 0) late++;
        else onTime++;
      });

      absent = Math.max(0, expectedDays - empAttendance.length);

      return {
        id: emp.id,
        name: emp.name,
        onTime,
        late,
        absent,
        total: onTime + late + absent
      };
    });

    // Calculate average on-time percentage
    const totalOnTime = perfData.reduce((sum, p) => sum + p.onTime, 0);
    const totalDays = perfData.reduce((sum, p) => sum + p.total, 0);
    const avgPercent = totalDays > 0 ? Math.round((totalOnTime / totalDays) * 100) : 0;
    if (summaryEl) summaryEl.textContent = avgPercent + '% average';

    // Prepare data for Chart.js horizontal bar chart
    const labels = perfData.map(p => `${p.name} (${p.id})`);
    const onTimeData = perfData.map(p => p.onTime);
    const lateData = perfData.map(p => p.late);
    const absentData = perfData.map(p => p.absent);

    if (performanceChart) {
      // Update existing chart
      performanceChart.data.labels = labels;
      performanceChart.data.datasets[0].data = onTimeData;
      performanceChart.data.datasets[1].data = lateData;
      performanceChart.data.datasets[2].data = absentData;
      performanceChart.update();
    } else {
      // Create new chart
      performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'On-time',
              data: onTimeData,
              backgroundColor: '#059669',
              borderRadius: 4
            },
            {
              label: 'Late',
              data: lateData,
              backgroundColor: '#f59e0b',
              borderRadius: 4
            },
            {
              label: 'Absent',
              data: absentData,
              backgroundColor: '#9ca3af',
              borderRadius: 4
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              beginAtZero: true,
              max: 6,
              ticks: {
                stepSize: 1
              }
            },
            y: {
              stacked: true
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }

  // Performance chart week navigation
  document.getElementById('perfPrevWeek')?.addEventListener('click', () => {
    perfWeekOffset--;
    renderPerformanceChart();
  });

  document.getElementById('perfNextWeek')?.addEventListener('click', () => {
    perfWeekOffset++;
    renderPerformanceChart();
  });

  // Performance chart search
  document.getElementById('perfSearchInput')?.addEventListener('input', (e) => {
    perfSearchQuery = e.target.value.trim();
    renderPerformanceChart();
  });

  document.getElementById('perfSearchClear')?.addEventListener('click', () => {
    const input = document.getElementById('perfSearchInput');
    if (input) input.value = '';
    perfSearchQuery = '';
    renderPerformanceChart();
  });

  // Leaves search
  document.getElementById('leavesSearch')?.addEventListener('input', (e) => {
    leavesSearchQuery = e.target.value.trim();
    renderLeaves();
  });

  // =============================================
  // QR CODE GENERATION
  // =============================================
  let currentQREmployeeId = null;
  let currentQREmployeeName = null;

  window.showEmployeeQR = async function(empId, empName) {
    currentQREmployeeId = empId;
    currentQREmployeeName = empName;

    const modal = document.getElementById('qrCodeModal');
    const container = document.getElementById('qrCodeContainer');
    const nameEl = document.getElementById('qrEmployeeName');
    const idEl = document.getElementById('qrEmployeeId');

    if (!modal || !container) return;

    // Update labels
    if (nameEl) nameEl.textContent = empName;
    if (idEl) idEl.textContent = `ID: ${empId}`;

    // Clear previous QR
    container.innerHTML = '';

    // Generate QR code with employee ID
    const qrData = `C4S-EMP-${empId}`;

    try {
      // Create QR code using qrcodejs library
      new QRCode(container, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#1e3a5f',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (err) {
      console.error('QR generation error:', err);
      container.innerHTML = '<p style="color:#ef4444">Failed to generate QR code</p>';
    }

    modal.style.display = 'flex';
  };

  // Download QR code as image WITH employee name and ID
  window.downloadEmployeeQR = function() {
    const container = document.getElementById('qrCodeContainer');
    if (!container) {
      if (window.toastError) toastError('Error', 'QR container not found');
      return;
    }

    const img = container.querySelector('img');
    const qrCanvas = container.querySelector('canvas');

    // Get QR image source
    let qrSrc = '';
    if (img && img.src) {
      qrSrc = img.src;
    } else if (qrCanvas) {
      qrSrc = qrCanvas.toDataURL('image/png');
    }

    if (!qrSrc) {
      if (window.toastError) toastError('Error', 'No QR code to download');
      return;
    }

    // Function to create the download image
    function createDownloadImage(qrImage) {
      const downloadCanvas = document.createElement('canvas');
      const ctx = downloadCanvas.getContext('2d');

      const qrSize = 256;
      const padding = 30;
      const headerHeight = 50;
      const footerHeight = 70;

      downloadCanvas.width = qrSize + (padding * 2);
      downloadCanvas.height = qrSize + headerHeight + footerHeight;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);

      // Draw employee name at top
      ctx.fillStyle = '#1e3a5f';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentQREmployeeName || 'Employee', downloadCanvas.width / 2, 35);

      // Draw QR code
      ctx.drawImage(qrImage, padding, headerHeight, qrSize, qrSize);

      // Draw employee ID below QR
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(`ID: ${currentQREmployeeId}`, downloadCanvas.width / 2, headerHeight + qrSize + 25);

      // Draw company name at bottom
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText('C4S Food Solution', downloadCanvas.width / 2, headerHeight + qrSize + 50);

      // Download
      const link = document.createElement('a');
      link.download = `QR-${currentQREmployeeName || 'Employee'}-${currentQREmployeeId}.png`;
      link.href = downloadCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.toastSuccess) toastSuccess('Success', 'QR code downloaded with employee info');
    }

    // Create new image from QR
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';

    qrImg.onload = function() {
      createDownloadImage(qrImg);
    };
    qrImg.onerror = function() {
      // If image fails, try using canvas directly
      if (qrCanvas) {
        createDownloadImage(qrCanvas);
      } else {
        if (window.toastError) toastError('Error', 'Failed to load QR image');
      }
    };

    qrImg.src = qrSrc;
  };


  // =============================================
  // INITIALIZE
  // =============================================
  init();

})();
