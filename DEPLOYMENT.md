# Voxora Production Deployment Guide

## Architecture Overview
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (FastAPI Docker)
- **Database**: Railway PostgreSQL + Redis
- **Storage**: AWS S3/Cloudflare R2
- **Monitoring**: Sentry
- **Domain**: Custom domain with SSL

## Step 1: Backend Setup (Railway)

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project: "voxora-api"

### 1.2 Configure Backend
```bash
# Clone your repo to GitHub first
git remote add origin https://github.com/drewsephski/voxora.git
git push -u origin main
```

### 1.3 Railway Environment Variables
Set these in Railway dashboard:

```env
# Core
ENVIRONMENT=production
LOG_LEVEL=INFO

# Database (Railway provides)
DATABASE_URL=${{RAILWAY_DATABASE_URL}}
REDIS_URL=${{RAILWAY_REDIS_URL}}

# Storage (AWS S3)
ENABLE_AWS_S3=true
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=voxora-audio

# Voice/AI Services
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Telephony
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Monitoring
SENTRY_DSN=your_sentry_dsn
ENABLE_TELEMETRY=true

# TURN Server (for WebRTC)
TURN_HOST=your-turn-server.com
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpass
```

### 1.4 Railway Dockerfile
Railway will use your existing `api/Dockerfile`

## Step 2: Frontend Setup (Vercel)

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import project: "voxora-ui"

### 2.2 Vercel Environment Variables
```env
NEXT_PUBLIC_BACKEND_URL=https://your-api.railway.app
BACKEND_URL=https://your-api.railway.app

NEXT_PUBLIC_NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_MODE=production
NEXT_PUBLIC_AUTH_PROVIDER=local

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key
POSTHOG_HOST=https://us.i.posthog.com

# Error tracking
SENTRY_DSN=your_sentry_dsn

# WebRTC
NEXT_PUBLIC_TURN_HOST=your-turn-server.com
```

### 2.3 Vercel Build Settings
```json
{
  "buildCommand": "cd ui && npm run build",
  "outputDirectory": "ui/.next",
  "installCommand": "cd ui && npm install"
}
```

## Step 3: Database Setup

### 3.1 Railway PostgreSQL
1. In Railway project, add PostgreSQL service
2. Note the connection URL
3. Run migrations:

```bash
# Connect to Railway shell
railway shell

# Run migrations
cd api && alembic upgrade head
```

### 3.2 Railway Redis
1. Add Redis service to Railway project
2. Note the Redis URL
3. Update environment variables

## Step 4: Storage Setup (AWS S3)

### 4.1 Create S3 Bucket
```bash
# Using AWS CLI
aws s3 mb s3://voxora-audio --region us-east-1
aws s3api put-bucket-cors --bucket voxora-audio --cors-configuration file://cors.json
```

### 4.2 CORS Configuration (cors.json)
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://voxora.com", "https://www.voxora.com"],
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

## Step 5: TURN Server Setup (WebRTC)

### 5.1 Option 1: Use coturn on Railway
Add this to your `docker-compose.yaml`:
```yaml
services:
  coturn:
    image: coturn/coturn:4.6.3
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    environment:
      TURN_USERNAME: ${TURN_USERNAME}
      TURN_PASSWORD: ${TURN_PASSWORD}
```

### 5.2 Option 2: Use Twilio TURN
```env
TURN_HOST=global.turn.twilio.com:3478
TURN_USERNAME=your_twilio_account_sid
TURN_PASSWORD=your_twilio_auth_token
```

## Step 6: Domain & SSL

### 6.1 Configure Custom Domain
1. **Vercel**: Add domain `voxora.com`
2. **Railway**: Add domain `api.voxora.com`
3. Update DNS:
   ```
   voxora.com -> Vercel nameservers
   api.voxora.com -> Railway load balancer IP
   ```

### 6.2 SSL Certificates
Both Vercel and Railway provide automatic SSL

## Step 7: Monitoring Setup

### 7.1 Sentry Error Tracking
1. Create Sentry account
2. Create two projects: "voxora-api" and "voxora-ui"
3. Add Sentry DSNs to environment variables

### 7.2 Health Checks
Add health endpoints:
```python
# api/routes/health.py
@router.get("/health")
async def health_check():
    return {"status": "healthy"}
```

## Step 8: API Keys Setup

### 8.1 Essential Services
1. **OpenAI**: Create API key at platform.openai.com
2. **Twilio**: Get account SID and auth token
3. **AWS**: Create IAM user with S3 access
4. **Sentry**: Create error tracking project

### 8.2 Security Best Practices
- Use Railway's secret management
- Rotate keys regularly
- Use least privilege principle
- Monitor API usage

## Step 9: Deployment Commands

### 9.1 Deploy Backend
```bash
git push origin main  # Triggers Railway auto-deploy
```

### 9.2 Deploy Frontend
```bash
git push origin main  # Triggers Vercel auto-deploy
```

## Step 10: Testing & Verification

### 10.1 Health Checks
```bash
# Backend
curl https://api.voxora.com/api/v1/health

# Frontend
curl https://voxora.com
```

### 10.2 Integration Tests
1. Test voice agent creation
2. Test WebRTC connection
3. Test telephony integration
4. Test file uploads

## Cost Estimates (Monthly)

- **Railway**: $20-50 (API + Database + Redis)
- **Vercel**: $0-20 (Frontend)
- **AWS S3**: $5-20 (Storage)
- **Twilio**: $1-10 (Phone numbers + usage)
- **OpenAI**: $10-100 (AI usage)
- **Domain**: $12/year

**Total**: ~$50-200/month depending on usage

## Next Steps

1. Create accounts on all platforms
2. Set up repositories and push code
3. Configure environment variables
4. Deploy and test
5. Set up monitoring
6. Configure custom domain

Would you like me to help you with any specific step?
