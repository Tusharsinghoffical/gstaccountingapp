# GST Accounting & Ledger Platform

A comprehensive, enterprise-grade Django application for managing GST-compliant accounting, invoices, and payments.

## Features

- **Dashboard**: Real-time analytics, KPI tracking (Sales, Purchase, Cash flow), and visual charts using Chart.js.
- **Party Master**: Manage Customers and Suppliers with GSTIN validation and automatic ledger creation.
- **Sales & Purchase Invoices**: Full GST (CGST/SGST/IGST) and TDS compliance.
- **AI OCR Integration**: Automatically extract data from purchase invoice PDFs/images.
- **Payment Module**: Multi-mode payments (Cash, Bank, UPI, Cheque) with intelligent invoice allocation.
- **Advanced Reports**: 
    - Party Ledger with running balance.
    - Outstanding & Ageing Analysis.
    - GSTR-1 & GSTR-2 Export.
    - TDS Section-wise report.
    - Excel & PDF exports for all reports.
- **Security & RBAC**: Role-based access control (Admin, Accountant, Auditor) and full Audit Trail.
- **Modern UI**: Built with Tailwind CSS, Alpine.js, and HTMX for a seamless, interactive experience.

## Setup Instructions

### 1. Prerequisites
- Python 3.11+
- Virtualenv

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd gst-accounting

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///db.sqlite3
```

### 4. Database Setup
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

### 5. Running the Application
```bash
python manage.py runserver
```

## Production Polish
- Branded 404 and 500 error pages.
- HTMX polling for real-time notifications.
- SessionStorage auto-save for long forms.
- Compressed assets and skeleton loaders.
