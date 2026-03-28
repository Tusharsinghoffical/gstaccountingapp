# 🚀 GST Accounting Software - Enterprise Edition

**A Complete GST/Accounting Solution for Indian SMEs** | Built with Django

![Version](https://img.shields.io/badge/version-1.0.0--Stable-blue)
![Django](https://img.shields.io/badge/Django-4.2.13-green)
![Python](https://img.shields.io/badge/Python-3.11+-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📋 Overview

GST Ledger is a comprehensive, production-ready accounting software designed specifically for **Indian Small and Medium Enterprises (SMEs)** and accountants. It provides complete GST compliance, invoicing, payment tracking, and financial reporting - all in one platform.

### ✨ Key Features

- 🧾 **Sales & Purchase Invoicing** - Create GST-compliant invoices with OCR support
- 💰 **Payment Management** - Track payments and allocate to invoices
- 👥 **Party Management** - Manage customers and suppliers with ledgers
- 📊 **Financial Reports** - GST reports, outstanding summaries, ageing analysis
- 🏦 **Cash & Bank Book** - Monitor cash flow and bank transactions
- 📄 **TDS Tracking** - TDS deduction and reporting
- 🔐 **Role-Based Access** - Admin, Accountant, and Auditor roles
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🔍 **OCR Integration** - Auto-extract invoice data from images/PDFs

---

## 🎯 Who Should Use This?

- ✅ **Small Business Owners** - Manage your accounts professionally
- ✅ **CA Firms & Practicing Accountants** - Handle multiple clients efficiently  
- ✅ **Retailers & Traders** - GST billing and inventory tracking
- ✅ **Service Providers** - Professional invoicing and payment tracking
- ✅ **Wholesalers & Distributors** - B2B invoicing with GST
- ✅ **Manufacturers** - Complete accounting solution

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11 or higher
- pip package manager
- Git (optional, for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/Tusharsinghoffical/gstaccountingapp.git
cd gstaccountingapp

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

Access the application at: **http://127.0.0.1:8000/**

---

## 🌐 Deployment

### Deploy to Render (FREE)

This project is configured for one-click deployment on Render:

1. Push code to GitHub (already done!)
2. Go to https://render.com/
3. Create new Web Service
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn gst_accounting.wsgi:application --bind 0.0.0.0:$PORT`
6. Add environment variables:
   - `DEBUG` = `False`
   - `SECRET_KEY` = (generate secure key)
   - `ALLOWED_HOSTS` = `*`
   - `DATABASE_URL` = `sqlite:///db.sqlite3`

**Your app will be live in 5-10 minutes!**

---

## 🛠️ Technology Stack

### Backend
- **Django 4.2** - Web framework
- **Python 3.11+** - Programming language
- **SQLite/PostgreSQL** - Database
- **Gunicorn** - WSGI server

### Frontend
- **HTML5/CSS3** - Modern markup
- **Tailwind CSS** - Utility-first styling
- **Alpine.js** - Lightweight JavaScript
- **Chart.js** - Data visualization

### Libraries
- **openpyxl** - Excel file handling
- **xhtml2pdf** - PDF generation
- **Pillow** - Image processing
- **num2words** - Amount to words conversion
- **WhiteNoise** - Static file serving

---

## 📁 Project Structure

```
gst-accounting/
├── core/                    # Main application
│   ├── models.py           # Database models
│   ├── views.py            # View controllers
│   ├── forms.py            # Form definitions
│   ├── services.py         # Business logic
│   └── utils.py            # Helper functions
├── audit/                   # Audit trail module
├── templates/               # HTML templates
├── static/                  # CSS, JS, images
├── media/                   # User uploads
├── requirements.txt         # Python dependencies
├── manage.py               # Django management
└── README.md               # This file
```

---

## 🔒 Security Features

- ✅ CSRF protection on all forms
- ✅ SQL injection prevention via Django ORM
- ✅ XSS protection through template auto-escaping
- ✅ Password hashing with Django's PBKDF2
- ✅ Role-based access control
- ✅ Session security management
- ✅ Environment variable configuration

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

Copyright (c) 2026 GST Ledger Platform

---

## 👨‍💻 Author

**Tushar Singh**
- GitHub: [@Tusharsinghoffical](https://github.com/Tusharsinghoffical)

---

**Made with ❤️ for Indian SMEs & Accountants**

*Built in India 🇮🇳 | For India 🇮🇳*