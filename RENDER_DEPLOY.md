# 🚀 Render.com Deployment Guide - Xtract IQ Forms

## Quick Deploy in 5 Minutes!

### Step 1: Push to GitHub ✅

```powershell
# Verify no secrets in git
git status

# Commit and push
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

### Step 2: Deploy on Render 🌐

#### A. Create Render Account
1. Go to **[render.com](https://render.com)**
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (recommended)
4. Authorize Render to access your repositories

#### B. Deploy with Blueprint
1. In Render Dashboard, click **"New +"** → **"Blueprint"**
2. Select your repository: **`Xtract-IQ-Forms-`**
3. Render will auto-detect `render.yaml`
4. Click **"Apply"** to create both services

**Two services will be created:**
- ✅ `xtract-iq-backend` (Node.js API)
- ✅ `xtract-iq-frontend` (React Static Site)

---

### Step 3: Configure Environment Variables 🔐

#### For Backend Service (`xtract-iq-backend`):

1. Go to your backend service in Render dashboard
2. Click **"Environment"** tab
3. Add these variables:

```
GROQ_API_KEY=gsk_your_actual_groq_api_key
AZURE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_API_KEY=your_actual_azure_api_key
NEON_DB_URL=postgresql://username:password@host/database_name
NEON_AFTER_DB_URL=postgresql://username:password@host/database_after_name
```

**Where to get these:**
- **GROQ_API_KEY**: [console.groq.com/keys](https://console.groq.com/keys)
- **Azure keys**: Azure Portal → Your Computer Vision resource
- **Neon URLs**: [console.neon.tech](https://console.neon.tech)

4. Click **"Save Changes"**

#### For Frontend Service (`xtract-iq-frontend`):

1. Go to your frontend service in Render dashboard
2. Click **"Environment"** tab
3. Add this variable:

```
VITE_API_URL=https://xtract-iq-backend.onrender.com
```

**⚠️ Important**: Replace `xtract-iq-backend` with your **actual backend service URL**
- Find it in Render dashboard under your backend service
- It will look like: `https://xtract-iq-backend-xyz.onrender.com`

4. Click **"Save Changes"**

---

### Step 4: Deploy! 🎉

After adding environment variables:
1. Render **automatically redeploys** both services
2. Wait 5-10 minutes for deployment
3. Watch the **Logs** tab for any errors

**Deployment Status:**
- 🟢 Green = Live and running
- 🟡 Yellow = Building/Deploying
- 🔴 Red = Failed (check logs)

---

### Step 5: Test Your Deployment ✅

#### Test Backend Health:
Visit: `https://your-backend-url.onrender.com/api/health`

Expected response:
```json
{"status":"ok","message":"Server is running"}
```

#### Test Frontend:
Visit: `https://your-frontend-url.onrender.com`

You should see your React app!

#### Test Full Workflow:
1. Upload a form image or PDF
2. Check if OCR extracts text
3. Verify AI structures the data
4. Confirm data appears in the table

---

## 📋 Your Live URLs

After deployment completes, save these URLs:

**Backend API**: `https://__________________.onrender.com`

**Frontend App**: `https://__________________.onrender.com` ⭐ **Use this for your portfolio!**

---

## ⚠️ Important Notes

### Free Tier Limitations:
- ✅ 750 hours/month free (enough for portfolio)
- ⚠️ Services **sleep after 15 minutes** of inactivity
- ⏱️ First request after sleep = **30-50 seconds** to wake up
- 💡 Tip: Visit your site regularly to keep it active

### API Rate Limits:
- **Groq Free Tier**: 30 requests/minute
- **Azure Free Tier**: Check your Azure quota
- **Neon Free Tier**: 3GB storage, 100 hours compute/month

---

## 🐛 Troubleshooting

### Build Failed?
1. Check **Logs** in Render dashboard
2. Verify `package.json` exists in both `backend/` and `my-react-app/`
3. Ensure all dependencies are listed

### Backend Not Starting?
1. Verify all environment variables are set correctly
2. Check for typos in API keys
3. View **Logs** for specific errors

### Frontend Can't Connect to Backend?
1. Verify `VITE_API_URL` points to correct backend URL
2. Check CORS is enabled (already configured in `server.js`)
3. Ensure backend is running (green status)

### Database Connection Failed?
1. Check `NEON_DB_URL` format: `postgresql://user:pass@host/db`
2. Verify database exists in Neon
3. Check SSL settings (already configured)

---

## 🔄 Updates & Redeployment

### Auto-Deploy on Git Push:
```powershell
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Render automatically redeploys! 🎉
```

### Manual Redeploy:
1. Go to service in Render dashboard
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 📊 Monitoring

### View Logs:
- Go to service → **"Logs"** tab
- Real-time logs of your application
- Filter by errors, warnings, info

### Check Metrics:
- Go to service → **"Metrics"** tab
- CPU, Memory, Request counts
- Response times

---

## 💰 Upgrade Options (Optional)

If your app gets popular:

| Plan | Price | Benefits |
|------|-------|----------|
| **Free** | $0/month | Perfect for portfolio |
| **Starter** | $7/month | No sleep, better performance |
| **Standard** | $25/month | More resources, custom domains |

---

## 📝 Next Steps

- [ ] Update README.md with live URLs
- [ ] Add to your portfolio website
- [ ] Share on LinkedIn
- [ ] Test all features thoroughly
- [ ] Monitor usage and logs

---

## 🎯 Your Deployment Checklist

- [ ] GitHub repository is public and pushed
- [ ] All `.env` files are in `.gitignore`
- [ ] Render account created
- [ ] Blueprint deployed (2 services created)
- [ ] Backend environment variables added
- [ ] Frontend environment variable added (`VITE_API_URL`)
- [ ] Both services show green status
- [ ] Backend health check responds
- [ ] Frontend loads correctly
- [ ] Test upload works end-to-end
- [ ] URLs added to portfolio

---

## 🆘 Need Help?

1. **Check Render Status**: [status.render.com](https://status.render.com)
2. **Render Docs**: [render.com/docs](https://render.com/docs)
3. **Check Logs**: Most issues show up in logs
4. **GitHub Issues**: Check if others had similar problems

---

## 🎉 Congratulations!

Your app is now live and ready for your portfolio! 🚀

**Pro Tip**: Keep the Render dashboard bookmarked to monitor your app's health and usage.

---

Last Updated: November 2025
