# IMC Volunteer Planner - AWS Setup Guide

Complete setup instructions for deploying the IMC Volunteer Planner backend on AWS.

---

## Prerequisites

- AWS account with admin access
- AWS CLI installed and configured (`aws configure`)
- Node.js 18+ installed
- Git access to the repository

---

## Step 1: DynamoDB Table

The setup script creates the DynamoDB table with the correct schema and GSI.

```bash
cd functions
npm install
npm run setup-db
```

This creates:
- Table: `imc-volunteer-planner`
- Primary key: `pk` (String) / `sk` (String)
- GSI: `GSI1` on `GSI1PK` / `GSI1SK`

**Save the `ORG_ID` printed at the end.** You will need it for Lambda configuration.

---

## Step 2: Lambda Function

### Create the function

1. Go to **AWS Console > Lambda > Create function**
2. Settings:
   - **Function name:** `imc-volunteer-planner`
   - **Runtime:** Node.js 18.x
   - **Architecture:** x86_64
   - **Memory:** 256 MB
   - **Timeout:** 30 seconds

### Upload code

From the project root:

```bash
cd functions
npm install --omit=dev
zip -r ../function.zip handler.js shared/ api/ node_modules/ package.json
```

Then upload `function.zip` via the Lambda console, or:

```bash
aws lambda update-function-code \
  --function-name imc-volunteer-planner \
  --zip-file fileb://function.zip
```

### Set environment variables

In **Lambda > Configuration > Environment variables**, add:

| Variable | Value |
|----------|-------|
| `TABLE_NAME` | `imc-volunteer-planner` |
| `FROM_EMAIL` | `noreply@imcpalatine.org` (or your verified SES email) |
| `FRONTEND_URL` | `https://imcpalatine.netlify.app` (or your custom domain) |
| `ORG_ID` | The org ID from Step 1 output |

### Attach IAM policy

The Lambda execution role needs these permissions. Go to **Lambda > Configuration > Permissions > Execution role**, then attach a policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/imc-volunteer-planner",
        "arn:aws:dynamodb:us-east-1:*:table/imc-volunteer-planner/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Step 3: API Gateway

### Create HTTP API

1. Go to **AWS Console > API Gateway > Create API > HTTP API**
2. Name: `imc-volunteer-planner-api`

### Add routes

Add two routes:

| Method | Path | Integration |
|--------|------|-------------|
| `ANY` | `/api/{proxy+}` | Lambda: `imc-volunteer-planner` |
| `OPTIONS` | `/api/{proxy+}` | Lambda: `imc-volunteer-planner` |

### Configure integration

- Integration type: **Lambda function**
- Lambda function: `imc-volunteer-planner`
- Payload format version: **2.0**

### Deploy

- Deploy to the `$default` stage (auto-deploy should be ON by default)
- Note the **Invoke URL** (looks like `https://abc123def.execute-api.us-east-1.amazonaws.com`)

You will use this URL in the Netlify config.

---

## Step 4: SES Setup

### Verify sender email

1. Go to **AWS Console > SES > Verified identities**
2. Click **Create identity**
3. Choose **Email address**
4. Enter the FROM_EMAIL you set in Step 2 (e.g., `noreply@imcpalatine.org`)
5. Check inbox and click the verification link

### If in SES sandbox

By default, new AWS accounts are in the SES sandbox. This means you can only send to verified email addresses.

For testing:
- Verify each recipient email address in SES

For production:
1. Go to **SES > Account dashboard**
2. Click **Request production access**
3. Fill out the form (use case: transactional emails for volunteer coordination)
4. Wait for approval (usually 24 hours)

---

## Step 5: Netlify

### Connect repository

1. Go to [app.netlify.com](https://app.netlify.com) and click **Add new site > Import an existing project**
2. Connect to GitHub and select the `imcpalatine/volunteer-planner` repository
3. Build settings:
   - **Build command:** (leave blank - no build step needed)
   - **Publish directory:** `frontend`

### Update API proxy

Edit `frontend/netlify.toml` and replace `YOUR_API_GATEWAY_URL` with the actual API Gateway invoke URL from Step 3:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://abc123def.execute-api.us-east-1.amazonaws.com/api/:splat"
  status = 200
  force = true
```

Commit and push this change. Netlify will auto-deploy.

### Verify

- Visit your Netlify URL (e.g., `https://imcpalatine.netlify.app`)
- The login page should load
- Test the magic link flow with a verified email

---

## Step 6: Create Admin User

Run the admin creation script from the project root:

```bash
node functions/scripts/create-admin.js \
  --email tom@example.com \
  --name "Tom Kashul" \
  --phone "8475551234" \
  --org-id <ORG_ID from Step 1>
```

This creates the admin user account. The admin can then log in via magic link and access the admin dashboard.

---

## Verification Checklist

After completing all steps, verify:

- [ ] DynamoDB table exists with correct schema
- [ ] Lambda function responds (test with a simple event in the console)
- [ ] API Gateway routes to Lambda correctly
- [ ] SES can send emails from your verified address
- [ ] Netlify site loads the frontend
- [ ] API proxy works (browser network tab shows `/api/*` requests succeeding)
- [ ] Admin can log in via magic link
- [ ] Admin dashboard loads with data

---

## Troubleshooting

**Magic link email not arriving:**
- Check SES > Sending statistics for bounces/complaints
- If in sandbox, verify the recipient email is also verified in SES
- Check Lambda CloudWatch logs for errors

**API returns 500:**
- Check Lambda CloudWatch logs
- Verify environment variables are set correctly
- Confirm IAM role has DynamoDB and SES permissions

**CORS errors in browser:**
- The Lambda handler returns CORS headers automatically
- Verify the API Gateway payload format is set to 2.0
- Check that OPTIONS routes are configured

**Netlify shows 404:**
- Verify publish directory is set to `frontend`
- Check that `netlify.toml` is in the `frontend/` directory
- Confirm the redirect rules are correct
