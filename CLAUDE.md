# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

C4S Food Solution Payroll Management System - A web-based payroll and attendance management system built with vanilla HTML, CSS, JavaScript, and Firebase.

## Development Commands

```bash
# Run local development server
cd projectsystem
python -m http.server 8000
# or
npx serve .

# Access the application
# Login page: http://localhost:8000/login.html
```

### Running Tests

Tests are standalone JavaScript files that can be run with Node.js:

```bash
node projectsystem/tests/attendance_calc_test.js
node projectsystem/tests/late_calc_test.js
```

Browser-based tests (like `attendance_browser_test.html`) should be opened directly in a browser while the dev server is running.

## Architecture

### Frontend-Only Architecture
This is a client-side application with no build step. All JavaScript runs in the browser and uses Firebase for backend services.

### Key Files

- **firebase-config.js**: Firebase project configuration (loaded first)
- **firebase-init.js**: Initializes Firebase and exposes global auth helpers:
  - `siasystemSignIn(email, password)` - Sign in
  - `siasystemCreateUser(email, password)` - Create user
  - `siasystemSignOut()` - Sign out
  - `siasystemOnAuth(callback)` - Auth state listener
- **shared.js**: Common utilities exposed globally:
  - `showToast()`, `toastSuccess()`, `toastError()`, `toastWarning()`, `toastInfo()`
  - `formatCurrency()`, `formatDate()`, `formatTime()`
  - `confirmDialog()`, `setButtonLoading()`
- **admin.js**: Admin dashboard logic (~163KB, handles employee management, payroll, attendance)
- **employee.js**: Employee portal logic (payslips, leave requests, attendance)

### Data Storage
- **Firebase Realtime Database**: Primary data store for employees, attendance, leave requests
- **localStorage**: Used for caching and offline fallback with keys like:
  - `payroll_employees` - Employee list
  - `payroll_attendance` - Attendance records
  - `payroll_credentials` - Cached credentials
  - `payroll_archive` - Archived employees
  - `employee_payslips_{id}` - Per-employee payslips

### Authentication Flow
1. Login attempts admin credentials first (hardcoded: admin/0304)
2. Falls back to Firebase Authentication for employee accounts
3. Stores `currentEmployeeId` and `currentEmployeeName` in localStorage for session
4. Redirects to appropriate dashboard based on user type

### Page Structure
- **login.html** → **admin_dashboard.html** (admin users)
- **login.html** → **employee_dashboard.html** (employees)
- **registration.html** (new employee signup)

## Code Patterns

### IIFE Pattern
Both `admin.js` and `employee.js` use immediately-invoked function expressions to encapsulate scope and prevent global pollution.

### Global Utilities
Shared functions are attached to `window` object for cross-file access (e.g., `window.showToast`, `window.formatCurrency`).

### Firebase SDK
Uses Firebase compat SDK (v9.23.0) loaded via CDN in HTML files.
