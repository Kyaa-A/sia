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
  let payslipSearchQuery = '';

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

    // Payslip search
    const searchInput = document.getElementById('payslipSearchInput');
    const searchClear = document.getElementById('payslipSearchClear');

    function updateClearBtnVisibility() {
      if (searchClear) {
        searchClear.style.display = searchInput && searchInput.value ? 'block' : 'none';
      }
    }

    if (searchInput) {
      updateClearBtnVisibility();
      searchInput.addEventListener('input', (e) => {
        payslipSearchQuery = e.target.value;
        updateClearBtnVisibility();
        renderPayslips();
      });
      searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = '#3b82f6';
        searchInput.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      });
      searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = '#d1d5db';
        searchInput.style.boxShadow = 'none';
      });
    }

    if (searchClear) {
      searchClear.addEventListener('mouseenter', () => {
        searchClear.style.color = '#374151';
        searchClear.style.background = '#f3f4f6';
      });
      searchClear.addEventListener('mouseleave', () => {
        searchClear.style.color = '#9ca3af';
        searchClear.style.background = 'none';
      });
      searchClear.addEventListener('click', () => {
        payslipSearchQuery = '';
        if (searchInput) searchInput.value = '';
        updateClearBtnVisibility();
        renderPayslips();
      });
    }

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
      const dailyRate = currentEmployee.salary || 510;
      salaryEl.textContent = `₱${Number(dailyRate).toLocaleString(undefined, {minimumFractionDigits: 2})} / day`;
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

    let monthPayslips = payslips.filter(p => {
      const weekStart = new Date(p.week_start);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });

    // Apply search filter
    if (payslipSearchQuery && payslipSearchQuery.trim() !== '') {
      const query = payslipSearchQuery.toLowerCase().trim();
      monthPayslips = monthPayslips.filter(p => {
        const date = (p.week_start || '').toLowerCase();
        const status = (p.status || '').toLowerCase();
        const grossNum = Number(p.gross_pay);
        const netNum = Number(p.net_pay);
        // Search in date, status, and amounts (raw numbers for easier matching)
        return date.includes(query) ||
               status.includes(query) ||
               String(Math.floor(grossNum)).includes(query) ||
               String(Math.floor(netNum)).includes(query) ||
               String(grossNum).includes(query) ||
               String(netNum).includes(query);
      });
    }

    tbody.innerHTML = '';

    if (monthPayslips.length === 0) {
      const msg = payslipSearchQuery ? 'No payslips matching your search' : 'No payslips for this month';
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#4b5563;padding:24px">${msg}</td></tr>`;
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
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#4b5563;padding:24px">No leave requests</td></tr>';
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

    // Validate: Cannot request leave for past dates
    // Use string comparison to avoid timezone issues
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');
    if (startDate < todayStr) {
      if (window.toastError) toastError('Error', 'Cannot request leave for past dates');
      return;
    }

    // Check for overlapping leave requests (Pending or Approved)
    const overlapping = leaveRequests.find(leave => {
      if (leave.status === 'Rejected' || leave.status === 'Cancelled') return false;
      const existingStart = new Date(leave.start_date);
      const existingEnd = new Date(leave.end_date);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      // Check if date ranges overlap
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (overlapping) {
      if (window.toastError) toastError('Error', `You already have a ${overlapping.status.toLowerCase()} leave request for ${overlapping.start_date} to ${overlapping.end_date}`);
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

    // Client's simple formula for display
    const dailyRate = 510;
    const RECEIPT_DAYS = 6;
    const lateDeduction = Number(payslip.late_deduction) || 0;
    const receiptGross = (RECEIPT_DAYS * dailyRate) - lateDeduction;
    const FIXED_DEDUCTIONS = 750;
    const receiptNet = Math.max(0, receiptGross - FIXED_DEDUCTIONS);

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
            <div class="muted">Rate/day</div>
            <div style="font-weight:600">₱${dailyRate.toFixed(2)}</div>
          </div>
        </div>
        <hr style="margin:16px 0">
        <div style="display:grid;grid-template-columns:1fr 40px 80px;gap:8px">
          <div>No. of Days:</div>
          <div style="text-align:center;font-weight:600">${RECEIPT_DAYS}</div>
          <div style="text-align:right;font-weight:600">₱${(RECEIPT_DAYS * dailyRate).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Late:</div>
          <div style="text-align:center"></div>
          <div style="text-align:right;color:#ef4444">₱${lateDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <hr style="margin:16px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="font-weight:600">Gross (monthly):</div>
          <div style="text-align:right;font-weight:600">₱${receiptGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div>Less:</div>
          <div style="text-align:right;color:#ef4444">₱${FIXED_DEDUCTIONS.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <hr style="margin:16px 0">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700">
          <span>Net (monthly):</span>
          <span style="color:#10b981">₱${receiptNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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

    // Load logo image first
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = function() {
      generatePDF(payslip, logoImg);
    };
    logoImg.onerror = function() {
      // Generate PDF without logo if image fails to load
      generatePDF(payslip, null);
    };
    logoImg.src = 'src/logo.png';
  };

  function generatePDF(payslip, logoImg) {
    const { jsPDF } = window.jspdf;
    // Receipt size: A5 (half A4)
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
    doc.text(currentEmployee.name || 'Unknown', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(currentEmployee.id, pageWidth / 2, y, { align: 'center' });

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
    doc.save(`payslip_${currentEmployee.name.replace(/\s+/g, '_')}_${payslip.week_start}.pdf`);
  };

  // =============================================
  // QR CODE (Same format as admin side)
  // =============================================
  window.showMyQR = function() {
    if (!currentEmployee) {
      if (window.toastError) toastError('Error', 'Employee data not loaded');
      return;
    }

    const modal = document.getElementById('myQrCodeModal');
    const container = document.getElementById('myQrCodeContainer');
    const nameEl = document.getElementById('myQrEmployeeName');
    const idEl = document.getElementById('myQrEmployeeId');

    if (!modal || !container) return;

    // Update labels
    if (nameEl) nameEl.textContent = currentEmployee.name;
    if (idEl) idEl.textContent = `ID: ${currentEmployee.id}`;

    // Clear previous QR
    container.innerHTML = '';

    // Generate QR code with employee ID (same format as admin)
    const qrData = `C4S-EMP-${currentEmployee.id}`;

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

  // Download QR code as image WITH employee name and ID (same format as admin)
  window.downloadMyQR = function() {
    if (!currentEmployee) {
      if (window.toastError) toastError('Error', 'Employee data not loaded');
      return;
    }

    const container = document.getElementById('myQrCodeContainer');
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

    // Function to create the download image (same format as admin)
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
      ctx.fillText(currentEmployee.name || 'Employee', downloadCanvas.width / 2, 35);

      // Draw QR code
      ctx.drawImage(qrImage, padding, headerHeight, qrSize, qrSize);

      // Draw employee ID below QR
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(`ID: ${currentEmployee.id}`, downloadCanvas.width / 2, headerHeight + qrSize + 25);

      // Draw company name at bottom
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText('C4S Food Solution', downloadCanvas.width / 2, headerHeight + qrSize + 50);

      // Download
      const link = document.createElement('a');
      link.download = `QR-${currentEmployee.name || 'Employee'}-${currentEmployee.id}.png`;
      link.href = downloadCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.toastSuccess) toastSuccess('Success', 'QR code downloaded');
    }

    // Create new image from QR
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';

    qrImg.onload = function() {
      createDownloadImage(qrImg);
    };
    qrImg.onerror = function() {
      if (window.toastError) toastError('Error', 'Failed to process QR code');
    };
    qrImg.src = qrSrc;
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
