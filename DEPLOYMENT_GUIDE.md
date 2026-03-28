# 🚀 Deploy Django to Render - Complete Guide

## Step-by-Step Instructions for Indian SMEs & Accountants

### 📋 Prerequisites
- Git installed on your computer
- GitHub account (free)
- Render account (free) - [Sign up here](https://render.com/)

---

## 🔧 STEP 1: Prepare Your Project

### 1.1 Create a `.gitignore` file
✅ Already created! This file prevents sensitive data from being uploaded.

### 1.2 Update requirements.txt
✅ Already updated with all production dependencies!

### 1.3 Configure settings.py for production
✅ Already configured! The settings now support environment variables.

---

## 🎯 STEP 2: Push to GitHub

### Option A: Using Git Bash / Terminal

```bash
# Navigate to your project folder
cd "c:\Users\tusha\Music\Account Software"

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for Render deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Option B: Using GitHub Desktop (Easier!)

1. Download **GitHub Desktop** from https://desktop.github.com/
2. Open GitHub Desktop → File → Add Local Repository
3. Select your project folder: `c:\Users\tusha\Music\Account Software`
4. Click "Commit to main"
5. Click "Publish repository"
6. Name it: `gst-accounting` or any name you like
7. Click "Publish"

---

## 🚀 STEP 3: Deploy to Render

### 3.1 Login to Render
- Go to https://render.com/
- Sign up/Login with GitHub

### 3.2 Create New Web Service
1. Click **"New +"** button
2. Select **"Web Service"**
3. Click **"Connect a repository"**

### 3.3 Connect GitHub Repository
1. Find your repository in the list
2. Click **"Connect"**

### 3.4 Configure Settings

**Fill in these details:**

| Field | Value |
|-------|-------|
| **Name** | `gst-accounting-app` (or any name) |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Root Directory** | (leave blank) |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn gst_accounting.wsgi:application --bind 0.0.0.0:$PORT` |

### 3.5 Choose Instance Type
- **Free Tier**: ✅ Select this (Free hosting!)
- **Instance Type**: Free

### 3.6 Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these one by one:

| Key | Value |
|-----|-------|
| `DEBUG` | `False` |
| `SECRET_KEY` | Generate one at https://djecrety.ir/ |
| `ALLOWED_HOSTS` | `*` |
| `DATABASE_URL` | `sqlite:///db.sqlite3` |

Click **"Add Environment Variable"** for each one.

### 3.7 Click "Create Web Service"

Wait 5-10 minutes for deployment. Your app will be live!

---

## 🌐 STEP 4: Access Your Live App

After deployment completes:
- You'll get a URL like: `https://gst-accounting-app.onrender.com`
- Click to open your live application!
- Share this URL with your team

---

## ⚙️ STEP 5: Create Superuser (Admin)

### Method 1: Using Render Shell (Recommended)

1. In your Render dashboard, click on your service
2. Go to **"Shell"** tab
3. Run these commands:

```bash
python manage.py createsuperuser
```

Enter:
- Username: `admin`
- Email: `your-email@example.com`
- Password: (enter strong password)

Now login at: `https://your-app-url.onrender.com/admin/`

### Method 2: Create via Code

Add this temporary view in `core/views.py`:

```python
from django.contrib.auth.models import User

def create_admin(request):
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'email@example.com', 'password123')
    return HttpResponse('Admin created!')
```

Add URL, visit once, then delete!

---

## 🗄️ STEP 6: Setup Database (PostgreSQL - Optional but Recommended)

For better performance on Render:

### 6.1 Create PostgreSQL Database on Render

1. In Render dashboard, click **"New +"**
2. Select **"PostgreSQL"**
3. Configuration:
   - **Name**: `gst-accounting-db`
   - **Region**: Singapore
   - **Database Size**: Free tier

4. Click **"Create Database"**

### 6.2 Get Database Connection String

1. After creation, copy the **Internal Database URL**
2. It looks like: `postgresql://user:password@host:5432/dbname`

### 6.3 Update Environment Variables

Go back to your Web Service → **Environment** tab

Add/Update:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### 6.4 Redeploy

Your app will automatically redeploy with the new database.

---

## 📝 Important Notes

### Media Files (Images, PDFs)

On Render, media files are temporary. For permanent storage:

**Option 1: Use AWS S3** (Recommended for production)
**Option 2: Use Cloudinary** (Easier, has free tier)

### Static Files

✅ Already configured! WhiteNoise will serve static files efficiently.

### Debug Mode

⚠️ **NEVER** run with `DEBUG=True` in production!

### Security

Change the `SECRET_KEY` before going live! Generate one at: https://djecrety.ir/

---

## 🔍 Troubleshooting

### Build Fails
```
Error: No such file or directory: 'requirements.txt'
```
**Solution**: Make sure requirements.txt is in the root folder of your repository.

### App Shows 500 Error
**Solution**: Check logs in Render dashboard → Logs tab

### Static Files Not Loading
**Solution**: Run this command in Render Shell:
```bash
python manage.py collectstatic --noinput
```

### Database Errors
**Solution**: Make sure DATABASE_URL is correctly set in environment variables.

---

## 💰 Cost Breakdown

| Service | Cost |
|---------|------|
| Render Web Service (Free) | ₹0/month |
| Render PostgreSQL (Free) | ₹0/month |
| **Total** | **₹0/month** 🎉 |

Note: Free tier services spin down after 15 minutes of inactivity. First request may take 30 seconds.

---

## 📞 Support

If you need help:
- Render Docs: https://render.com/docs
- Django Docs: https://docs.djangoproject.com/

---

## ✅ Deployment Checklist

- [ ] Git repository created
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Web service created on Render
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Superuser created
- [ ] Tested login
- [ ] (Optional) PostgreSQL database connected

---

**🎉 Congratulations! Your GST Accounting Software is now live on Render!**

Made with ❤️ for Indian SMEs & Accountants
