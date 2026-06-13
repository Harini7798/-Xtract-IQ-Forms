# DEPLOYMENT CHECKLIST

## ✅ Pre-Deployment Checklist

### 1. Code Preparation
- [x] All API keys moved to environment variables
- [x] `.env` files created with correct values
- [x] `.gitignore` properly configured to exclude `.env` files
- [x] Production configurations added to `server.js`
- [x] Health check endpoint added (`/api/health`)
- [x] CORS configured for production

### 2. Files Created/Updated
- [x] `backend/.env` - Backend environment variables (DO NOT COMMIT)
- [x] `backend/.env.example` - Template for environment variables
- [x] `my-react-app/.env.production` - Frontend production config
- [x] `render.yaml` - Deployment configuration for both services
- [x] `README.md` - Complete documentation
- [x] `.gitignore` files updated in both backend and frontend

### 3. Git Repository
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Verify `.env` files are NOT in GitHub (check repository online)

## 🚀 Deployment Steps

### Step 1: GitHub Push
```bash
git status  # Verify .env is NOT listed
git add .
git commit -m "Production ready deployment"
git push origin main
```

### Step 2: Render Setup

1. **Create Account**
   - Go to https://render.com
   - Sign up with GitHub
   - Authorize Render to access repositories

2. **Deploy with Blueprint**
   - Click "New +" → "Blueprint"
   - Select your repository
   - Render auto-detects `render.yaml`
   - Click "Apply"

3. **Set Environment Variables**

   **Backend Service** (`form-extractor-backend`):
   ```
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   AZURE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
   AZURE_API_KEY=your_azure_api_key_here
   NEON_DB_URL=postgresql://username:password@host/database
   NEON_AFTER_DB_URL=postgresql://username:password@host/database_after
   ```

   **Frontend Service** (`form-extractor-frontend`):
   ```
   VITE_API_URL=https://form-extractor-backend.onrender.com
   ```
   
   ⚠️ Replace `form-extractor-backend` with your actual backend service URL from Render

4. **Deploy**
   - Render automatically builds and deploys
   - Wait for both services to be "Live" (green status)
   - Backend: ~5-10 minutes
   - Frontend: ~3-5 minutes

### Step 3: Test Deployment

1. **Test Backend Health**
   - Visit: `https://your-backend-name.onrender.com/api/health`
   - Should see: `{"status":"ok","message":"Server is running"}`

2. **Test Frontend**
   - Visit: `https://your-frontend-name.onrender.com`
   - Should load the React app
   - Try uploading a test document

3. **Test Full Workflow**
   - Upload an image/PDF
   - Check if OCR extracts text
   - Verify AI structures the data
   - Confirm data appears in the table

## 🔗 Your Live URLs

After deployment, update these URLs:

**Backend API**: `https://_____________________.onrender.com`

**Frontend App**: `https://_____________________.onrender.com`

Update README.md with these URLs for your portfolio!

## ⚠️ Important Notes

### Free Tier Limitations
- Services sleep after 15 minutes of inactivity
- First request after sleep takes 30-50 seconds to wake up
- 750 hours/month free (enough for a portfolio project)

### If Deployment Fails

1. **Check Build Logs**
   - Go to Render Dashboard → Your Service → Logs
   - Look for error messages

2. **Common Issues**
   - Missing environment variables → Add them in Render dashboard
   - Build command errors → Check `render.yaml` paths
   - Port conflicts → Ensure using `process.env.PORT`

3. **Re-deploy**
   - Fix issues locally
   - Push to GitHub
   - Render auto-deploys on push

## 📊 Monitoring

- **Render Dashboard**: Monitor uptime, logs, and metrics
- **Backend Logs**: Check for API errors
- **Frontend**: Test user interactions

## 🎯 Next Steps

- [ ] Update README.md with live URLs
- [ ] Test all features on production
- [ ] Add URLs to your portfolio
- [ ] Share with potential employers/clients
- [ ] Monitor usage and errors

## 💡 Tips

1. Keep your free tier active by visiting the site regularly
2. Monitor Groq API usage (30 req/min limit on free tier)
3. Consider upgrading if you get significant traffic
4. Add Google Analytics to track visitors

---

✅ Deployment Complete! Your app is live and ready for your portfolio!
