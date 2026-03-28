# 🚀 Quick Deploy to Render - GST Accounting Software

## ⚡ Fast Track Deployment (5 Minutes!)

### Step 1: Install Git
Download from: https://git-scm.com/download/win

### Step 2: Setup Project
Open Command Prompt in your project folder and run:

```bash
# Initialize Git
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"
```

### Step 3: Push to GitHub
1. Go to https://github.com/new
2. Create a new repository (name it anything)
3. Copy the commands shown and run them

### Step 4: Deploy to Render
1. Go to https://render.com/
2. Sign up with GitHub
3. Click **New +** → **Web Service**
4. Connect your GitHub repository
5. Use these settings:

```
Name: gst-accounting
Region: Singapore
Build Command: pip install -r requirements.txt
Start Command: python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn gst_accounting.wsgi:application --bind 0.0.0.0:$PORT
```

6. Add Environment Variables:
   - `DEBUG` = `False`
   - `SECRET_KEY` = (generate at https://djecrety.ir/)
   - `ALLOWED_HOSTS` = `*`
   - `DATABASE_URL` = `sqlite:///db.sqlite3`

7. Click **Create Web Service**

### Step 5: Done! 🎉
Your app will be live at: `https://your-app-name.onrender.com`

---

## 📚 Need Detailed Instructions?

Open **DEPLOYMENT_GUIDE.md** for complete step-by-step guide!

---

## 🆘 Troubleshooting

**Problem**: Build failed
**Solution**: Check if all files are committed to Git

**Problem**: App shows error 500
**Solution**: Check Render logs in dashboard

**Problem**: Can't login
**Solution**: Create superuser via Render Shell tab

---

## 💰 It's FREE!
Render free tier includes:
- ✅ Free hosting
- ✅ Free PostgreSQL database
- ✅ Automatic HTTPS
- ✅ Auto-deploy on git push

---

**Made for Indian SMEs & Accountants** 🇮🇳
