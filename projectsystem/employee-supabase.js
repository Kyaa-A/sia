/**
 * Employee Dashboard JavaScript (Supabase Version)
 * C4S Food Solution Payroll System
 */

(async function() {
  'use strict';

  // =============================================
  // STATE
  // =============================================
  let currentEmployee = null;
  let payslips = [];
  let leaveRequests = [];
  let currentPayslipMonth = new Date();

  // Get employee ID from session
  const currentEmployeeId = localStorage.getItem('currentEmployeeId');
  if (!currentEmployeeId || currentEmployeeId === 'ADMIN') {
    window.location.href = 'login.html';
    return;
  }

  // =============================================
  // INITIALIZATION
  // =============================================
  async function init() {
    try {
      await loadEmployeeData();
      setupEventListeners();
      setupRealtimeSubscriptions();
      renderProfile();
      renderPayslips();
      renderLeaveRequests();
    } catch (err) {
      console.error('Initialization error:', err);
      if (window.toastError) toastError('Error', 'Failed to load data. Please refresh.');
    }
  }

  async function loadEmployeeData() {
    // Load employee info
    const { data: emp, error } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('id', currentEmployeeId)
      .single();

    if (error || !emp) {
      console.error('Failed to load employee:', error);
      window.location.href = 'login.html';
      return;
    }

    currentEmployee = emp;

    // Load payslips
    const { data: payslipData } = await supabaseClient
      .from('payslips')
      .select('*')
      .eq('employee_id', currentEmployeeId)
      .order('week_start', { ascending: false });

    payslips = payslipData || [];

    // Load leave requests
    const { data: leaveData } = await supabaseClient
      .from('leave_requests')
      .select('*')
      .eq('employee_id', currentEmployeeId)
      .order('created_at', { ascending: false });

    leaveRequests = leaveData || [];
  }

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================
  function setupRealtimeSubscriptions() {
    // Subscribe to payslip changes for this employee
    supabaseClient
      .channel('employee-payslips')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payslips',
        filter: `employee_id=eq.${currentEmployeeId}`
      }, () => {
        loadEmployeeData().then(() => {
          renderPayslips();
          renderRequestsSidebar();
        });
      })
      .subscribe();

    // Subscribe to leave request changes for this employee
    supabaseClient
      .channel('employee-leaves')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `employee_id=eq.${currentEmployeeId}`
      }, () => {
        loadEmployeeData().then(() => {
          renderLeaveRequests();
          renderRequestsSidebar();
        });
      })
      .subscribe();
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

    // Leave form submission
    const leaveForm = document.getElementById('leaveForm');
    if (leaveForm) {
      leaveForm.addEventListener('submit', handleLeaveSubmit);
    }

    // Payslip month navigation
    const prevBtn = document.getElementById('payslipPrevMonth');
    const nextBtn = document.getElementById('payslipNextMonth');
    if (prevBtn) prevBtn.addEventListener('click', () => navigatePayslipMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigatePayslipMonth(1));

    // Close modals
    const closePayslip = document.getElementById('closePayslip');
    if (closePayslip) closePayslip.addEventListener('click', closePayslipModal);

    // Cancel confirmation modal
    const cancelConfirmNo = document.getElementById('cancelConfirmNo');
    const cancelConfirmYes = document.getElementById('cancelConfirmYes');
    if (cancelConfirmNo) cancelConfirmNo.addEventListener('click', closeCancelModal);
    if (cancelConfirmYes) cancelConfirmYes.addEventListener('click', confirmCancelLeave);
  }

  // =============================================
  // SECTION SWITCHING
  // =============================================
  function switchSection(section) {
    // Show/hide main sections
    const profileCard = document.querySelector('.card.section');
    const payslipCard = document.querySelectorAll('.card.section')[1];
    const requestsSection = document.getElementById('requestsSection');

    if (section === 'home') {
      if (profileCard) profileCard.style.display = 'block';
      if (payslipCard) payslipCard.style.display = 'block';
      if (requestsSection) requestsSection.style.display = 'none';
    } else if (section === 'requests') {
      if (profileCard) profileCard.style.display = 'none';
      if (payslipCard) payslipCard.style.display = 'none';
      if (requestsSection) requestsSection.style.display = 'block';
    }
  }

  // =============================================
  // RENDER FUNCTIONS
  // =============================================
  function renderProfile() {
    if (!currentEmployee) return;

    const nameEl = document.getElementById('empName');
    const roleEl = document.getElementById('empRole');
    const idEl = document.getElementById('empId');
    const usernameEl = document.getElementById('empUsername');
    const salaryEl = document.getElementById('empSalary');

    if (nameEl) nameEl.textContent = currentEmployee.name;
    if (roleEl) roleEl.textContent = currentEmployee.role;
    if (idEl) idEl.textContent = `ID: ${currentEmployee.id}`;
    if (usernameEl) usernameEl.textContent = currentEmployee.name;
    if (salaryEl) {
      const weeklySalary = (currentEmployee.salary / 52).toFixed(2);
      salaryEl.textContent = `₱${Number(weeklySalary).toLocaleString(undefined, {minimumFractionDigits: 2})} / week`;
    }

    // Update avatar
    const avatars = document.querySelectorAll('.admin-avatar');
    avatars.forEach(av => {
      av.textContent = currentEmployee.name.charAt(0).toUpperCase();
    });

    renderRequestsSidebar();
  }

  function renderPayslips() {
    const tbody = document.querySelector('#payslipTable tbody');
    const monthLabel = document.getElementById('payslipMonthLabel');

    if (!tbody) return;

    // Update month label
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthLabel) {
      monthLabel.textContent = `${months[currentPayslipMonth.getMonth()]} ${currentPayslipMonth.getFullYear()}`;
    }

    // Filter payslips for current month
    const monthStart = new Date(currentPayslipMonth.getFullYear(), currentPayslipMonth.getMonth(), 1);
    const monthEnd = new Date(currentPayslipMonth.getFullYear(), currentPayslipMonth.getMonth() + 1, 0);

    const monthPayslips = payslips.filter(p => {
      const weekStart = new Date(p.week_start);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    tbody.innerHTML = '';

    if (monthPayslips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:24px">No payslips for this month</td></tr>';
      return;
    }

    monthPayslips.forEach(payslip => {
      const statusClass = payslip.status === 'Approved' ? 'badge-success' :
                         payslip.status === 'Rejected' ? 'badge-error' : 'badge-warning';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${payslip.week_start}</td>
        <td>₱${Number(payslip.gross_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td>₱${Number(payslip.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td><span class="badge ${statusClass}">${payslip.status}</span></td>
        <td style="display:flex;gap:6px">
          <button class="secondary" onclick="viewPayslip('${payslip.id}')">View</button>
          <button style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer" onclick="downloadPayslipPDF('${payslip.id}')">Download</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function navigatePayslipMonth(direction) {
    currentPayslipMonth.setMonth(currentPayslipMonth.getMonth() + direction);
    renderPayslips();
  }

  function renderLeaveRequests() {
    const tbody = document.querySelector('#myRequestsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (leaveRequests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:24px">No leave requests</td></tr>';
      return;
    }

    leaveRequests.forEach((leave, index) => {
      const statusClass = leave.status === 'Approved' ? 'badge-success' :
                         leave.status === 'Rejected' ? 'badge-error' :
                         leave.status === 'Cancelled' ? 'badge-neutral' : 'badge-warning';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>Leave Request</td>
        <td>${leave.start_date} to ${leave.end_date}</td>
        <td style="word-wrap:break-word;white-space:normal">${leave.reason || '—'}</td>
        <td>${leave.leave_type}</td>
        <td><span class="badge ${statusClass}">${leave.status}</span></td>
        <td>
          ${leave.status === 'Pending' ? `<button class="warn" onclick="cancelLeave('${leave.id}')">Cancel</button>` : '—'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderRequestsSidebar() {
    const list = document.getElementById('requestsList');
    if (!list) return;

    const pendingLeaves = leaveRequests.filter(l => l.status === 'Pending');

    if (pendingLeaves.length === 0) {
      list.innerHTML = '<div class="muted">No pending requests</div>';
      return;
    }

    list.innerHTML = '';
    pendingLeaves.slice(0, 3).forEach(leave => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px 0;border-bottom:1px solid #eee';
      div.innerHTML = `
        <div style="font-weight:600">${leave.leave_type}</div>
        <div class="muted" style="font-size:12px">${leave.start_date} to ${leave.end_date}</div>
        <span class="badge badge-warning" style="margin-top:4px">${leave.status}</span>
      `;
      list.appendChild(div);
    });
  }

  // =============================================
  // LEAVE REQUEST HANDLING
  // =============================================
  async function handleLeaveSubmit(e) {
    e.preventDefault();

    const startDate = document.getElementById('leaveFrom').value;
    const endDate = document.getElementById('leaveTo').value;
    const reason = document.getElementById('leaveMessage').value.trim();
    const leaveType = document.getElementById('leaveType').value;

    if (!startDate || !endDate || !leaveType) {
      if (window.toastError) toastError('Error', 'Please fill in all required fields');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      if (window.toastError) toastError('Error', 'End date cannot be before start date');
      return;
    }

    try {
      const { error } = await supabaseClient
        .from('leave_requests')
        .insert([{
          employee_id: currentEmployeeId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          status: 'Pending'
        }]);

      if (error) throw error;

      if (window.toastSuccess) toastSuccess('Success', 'Leave request submitted');
      e.target.reset();

      await loadEmployeeData();
      renderLeaveRequests();
      renderRequestsSidebar();

    } catch (err) {
      console.error('Error submitting leave:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to submit leave request');
    }
  }

  let cancelLeaveId = null;

  window.cancelLeave = function(id) {
    cancelLeaveId = id;
    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.style.display = 'flex';
  };

  function closeCancelModal() {
    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.style.display = 'none';
    cancelLeaveId = null;
  }

  async function confirmCancelLeave() {
    if (!cancelLeaveId) return;

    try {
      const { error } = await supabaseClient
        .from('leave_requests')
        .update({ status: 'Cancelled' })
        .eq('id', cancelLeaveId);

      if (error) throw error;

      if (window.toastSuccess) toastSuccess('Success', 'Leave request cancelled');
      closeCancelModal();

      await loadEmployeeData();
      renderLeaveRequests();
      renderRequestsSidebar();

    } catch (err) {
      console.error('Error cancelling leave:', err);
      if (window.toastError) toastError('Error', err.message || 'Failed to cancel leave request');
    }
  }

  // =============================================
  // PAYSLIP MODAL
  // =============================================
  window.viewPayslip = function(id) {
    const payslip = payslips.find(p => p.id === id);
    if (!payslip) return;

    const content = document.getElementById('payslipContent');
    if (content) {
      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div class="muted">Employee</div>
            <div style="font-weight:600">${currentEmployee.name}</div>
          </div>
          <div>
            <div class="muted">Employee ID</div>
            <div style="font-weight:600">${currentEmployee.id}</div>
          </div>
          <div>
            <div class="muted">Period</div>
            <div style="font-weight:600">${payslip.week_start} to ${payslip.week_end}</div>
          </div>
          <div>
            <div class="muted">Status</div>
            <div style="font-weight:600">${payslip.status}</div>
          </div>
        </div>
        <hr style="margin:16px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>Gross Pay:</div>
          <div style="text-align:right;font-weight:600">₱${Number(payslip.gross_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>SSS:</div>
          <div style="text-align:right;color:#ef4444">-₱${Number(payslip.sss || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>PhilHealth:</div>
          <div style="text-align:right;color:#ef4444">-₱${Number(payslip.philhealth || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Pag-IBIG:</div>
          <div style="text-align:right;color:#ef4444">-₱${Number(payslip.pagibig || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Late Deduction:</div>
          <div style="text-align:right;color:#ef4444">-₱${Number(payslip.late_deduction || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <hr style="margin:16px 0">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700">
          <span>Net Pay:</span>
          <span style="color:#10b981">₱${Number(payslip.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
      `;
    }

    const modal = document.getElementById('payslipModal');
    if (modal) modal.style.display = 'flex';
  };

  function closePayslipModal() {
    const modal = document.getElementById('payslipModal');
    if (modal) modal.style.display = 'none';
  }

  // =============================================
  // PDF DOWNLOAD
  // =============================================
  window.downloadPayslipPDF = function(id) {
    const payslip = payslips.find(p => p.id === id);
    if (!payslip) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 25;

    // Format week dates nicely (Dec 15 - 21)
    const startDate = new Date(payslip.week_start);
    const endDate = new Date(payslip.week_end);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekLabel = `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}`;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYROLL - PAYSLIP', pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Week: ${weekLabel}`, pageWidth / 2, y, { align: 'center' });

    // Company logo placeholder (top right)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 0);
    doc.text('C4S', pageWidth - 30, 20);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('FOOD SOLUTION', pageWidth - 35, 25);
    doc.setTextColor(0, 0, 0);

    // Employee info
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(currentEmployee.name, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(currentEmployee.id, pageWidth / 2, y, { align: 'center' });

    // Rate per day (weekly salary / 6 working days)
    y += 10;
    const dailyRate = currentEmployee.salary ? (currentEmployee.salary / 6) : 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Rate/day: P${dailyRate.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });

    // Table
    y += 12;
    const tableX = 40;
    const tableWidth = pageWidth - 80;
    const col1Width = tableWidth - 50;
    const rowHeight = 10;

    // Draw table rows
    const rows = [
      ['Worked Hours (actual)', `${payslip.worked_hours || 0} h`],
      ['Payable Hours (capped)', `${payslip.payable_hours || 0} h`],
      ['Late', `${Math.floor((payslip.late_minutes || 0) / 60)}h ${(payslip.late_minutes || 0) % 60}m`],
      ['SSS', `P${Number(payslip.sss || 300)}`],
      ['PhilHealth', `P${Number(payslip.philhealth || 250)}`],
      ['Pag-IBIG', `P${Number(payslip.pagibig || 200)}`],
      ['Gross (week)', `P${Number(payslip.gross_pay || 0)}`],
      ['Net (week)', `P${Number(payslip.net_pay || 0)}`]
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const tableStartY = y;

    rows.forEach((row, index) => {
      // Row background alternating (optional, skip for clean look)
      // Draw horizontal line at top of row
      doc.line(tableX, y, tableX + tableWidth, y);

      // Draw text
      doc.setFont('helvetica', index >= 6 ? 'bold' : 'normal');
      doc.text(row[0], tableX + 3, y + 7);
      doc.text(row[1], tableX + tableWidth - 3, y + 7, { align: 'right' });

      y += rowHeight;
    });

    // Bottom line
    doc.line(tableX, y, tableX + tableWidth, y);

    // Left and right vertical lines
    doc.line(tableX, tableStartY, tableX, y);
    doc.line(tableX + tableWidth, tableStartY, tableX + tableWidth, y);
    // Middle vertical line
    doc.line(tableX + col1Width, tableStartY, tableX + col1Width, y);

    // Footer (centered)
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Received by: _____________________', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth / 2, y, { align: 'center' });

    // Download
    doc.save(`payslip_${currentEmployee.name.replace(/\s+/g, '_')}_${payslip.week_start}.pdf`);
  };

  // =============================================
  // LOGOUT
  // =============================================
  window.logout = function() {
    localStorage.removeItem('currentEmployeeId');
    localStorage.removeItem('currentEmployeeName');
    localStorage.removeItem('isAdmin');
    window.location.href = 'login.html';
  };

  // =============================================
  // INITIALIZE
  // =============================================
  init();

})();
