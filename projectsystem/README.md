# C4S Food Solution - Payroll Management System

A web-based payroll and attendance management system built with HTML, CSS, JavaScript, and Supabase.

## Features

### Admin Dashboard
- Employee management (add, edit, archive employees)
- Attendance tracking and monitoring
- Time clock management (Time In/Time Out)
- Payroll processing with automatic deductions
- Leave request management (approve/reject)
- Weekly attendance charts and reports
- Salary slip generation

### Employee Portal
- Personal dashboard with profile information
- View payslips by month
- Download payslips as PDF
- Submit leave requests
- Track leave request status

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Charts**: Chart.js
- **PDF Generation**: jsPDF, html2canvas
- **Hosting**: Vercel (recommended)

## Project Structure

```
projectsystem/
├── admin_dashboard.html    # Admin panel interface
├── admin-supabase.js       # Admin dashboard logic
├── admin.css               # Admin panel styles
├── employee_dashboard.html # Employee portal interface
├── employee-supabase.js    # Employee dashboard logic
├── employee.css            # Employee portal styles
├── login.html              # Login page
├── login.css               # Login/Registration styles
├── registration.html       # Employee registration
├── supabase-config.js      # Supabase configuration
├── supabase-db.js          # Database helper functions
├── shared.css              # Shared styles & utilities
├── shared-utils.js         # Shared JavaScript utilities
├── src/
│   └── logo.png            # Company logo
└── tests/                  # Test files
```

## Setup Instructions

### Prerequisites
- A Supabase project ([supabase.com](https://supabase.com))
- Node.js (for Vercel CLI) or any static file server

### 1. Clone the Repository

```bash
git clone https://github.com/Kyaa-A/sia.git
cd sia/projectsystem
```

### 2. Configure Supabase

Update `supabase-config.js` with your Supabase credentials:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Set Up Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Employees table
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Employee',
  salary DECIMAL DEFAULT 159120,
  sss_deduction DECIMAL DEFAULT 300,
  philhealth_deduction DECIMAL DEFAULT 250,
  pagibig_deduction DECIMAL DEFAULT 200,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
```

### 4. Run Locally

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Open `http://localhost:8000/login.html`

## Deployment (Vercel)

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd projectsystem
vercel --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Set root directory to `projectsystem`
5. Deploy

## Default Credentials

- **Admin Access**:
  - Username: `admin`
  - Password: `0304`

- **Employee Access**:
  - Register via the registration page

## Screenshots

### Login Page
Clean, modern login interface with animated gradient background.

### Admin Dashboard
Full-featured admin panel with sidebar navigation, employee management, attendance tracking, and payroll processing.

### Employee Portal
Employee self-service portal for viewing payslips and submitting leave requests.

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This project is proprietary software for C4S Food Solution.

## Support

For issues or questions, please open an issue on GitHub.
