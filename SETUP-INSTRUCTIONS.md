# Netlify Setup Instructions for Tom Sr.

## Step 1: Fix the Publish Directory

1. Go to your Netlify dashboard: https://app.netlify.com
2. Click on the **fluffy-platypus** site (icshrine.com)
3. Click **Site configuration** (left sidebar)
4. Click **Build & deploy**
5. Under **Build settings**, click **Configure**
6. Change these settings:
   - **Build command:** `echo done`
   - **Publish directory:** change from `frontend` to just a single dot: `.`
7. Click **Save**

## Step 2: Trigger a Fresh Deploy

1. Go back to the site overview
2. Click **Deploys** (left sidebar)
3. Click **Trigger deploy** button (top right)
4. Select **Clear cache and deploy site**
5. Wait for the deploy to finish (should take ~30 seconds)

## Step 3: Verify It Works

1. After deploy completes, visit: https://fluffy-platypus-415f62.netlify.app
2. You should see the IMC Volunteer Planner login page (dark theme, blue accents)
3. If you still see "Page not found", the publish directory didn't save — go back to Step 1

## Step 4: Verify Custom Domain

1. Go to **Domain management** in Netlify
2. Make sure `icshrine.com` is listed
3. Wait for DNS to propagate (can take up to 30 minutes after nameserver change)
4. Once DNS propagates, https://icshrine.com should show the same login page
5. Netlify will auto-provision the SSL certificate

## What the Publish Directory Means

The "publish directory" tells Netlify which folder in the repository contains the website files.
We moved all the website files to the root of the repository, so the publish directory should be `.` (dot = current directory = root).

## If Something Goes Wrong

Call Tom Jr. or text him.
