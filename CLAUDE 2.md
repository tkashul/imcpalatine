# IMC Volunteer Planner

## What This Is
Church volunteer event planner for IMC Palatine (Ukrainian Catholic parish). Admins create events (mass times, holidays), define shifts and parking locations, assign volunteers, send email invites. Volunteers see their schedule and accept/decline.

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Backend:** Node.js Lambda behind API Gateway
- **Database:** DynamoDB (single-table design)
- **Auth:** Email magic links (passwordless) via SES
- **Notifications:** SES email
- **Hosting:** Netlify (frontend) + AWS Lambda (backend)

## DynamoDB Single-Table Design

Table: `imc-volunteer-planner`

| Entity | PK | SK |
|--------|----|----|
| Org | `ORG#<orgId>` | `METADATA` |
| User in org | `ORG#<orgId>` | `USER#<userId>` |
| Event in org | `ORG#<orgId>` | `EVENT#<date>#<eventId>` |
| Event detail | `EVENT#<eventId>` | `METADATA` |
| Shift in event | `EVENT#<eventId>` | `SHIFT#<start>#<shiftId>` |
| Location in event | `EVENT#<eventId>` | `LOC#<locId>` |
| Assignment on shift | `SHIFT#<shiftId>` | `ASSIGN#<userId>` |
| User profile | `USER#<userId>` | `METADATA` |
| User's assignments | `USER#<userId>` | `ASSIGN#<shiftId>` |
| Auth token | `TOKEN#<token>` | `METADATA` |
| Email lookup | `EMAIL#<email>` | `METADATA` |

**GSI1:** `GSI1PK` / `GSI1SK` — for reverse lookups (e.g., find user by email)

## Project Structure
```
frontend/           # Static site (Netlify)
  index.html        # Landing / login
  admin/            # Admin views
  volunteer/        # Volunteer portal
  print/            # Printable day-of sheets
  css/style.css
  js/               # Client-side JS modules
functions/          # Lambda backend
  handler.js        # Entry point / router
  shared/           # DB, auth, response, email helpers
  api/              # Route handlers
seed/               # Data import scripts
infra/              # AWS setup docs
```

## Conventions
- Response helpers: `json(statusCode, body)`, `unauthorized()`, `badRequest(msg)`, `serverError(msg)`
- Auth: `requireAuth(event)` returns `{ userId, orgId, role }` or null
- All DynamoDB items include `entityType`, `createdAt`, `updatedAt`
- Frontend: Global namespace pattern, no framework, CSS variables for theming
- Phone numbers stored as digits only, formatted on display

## Deployment
- Frontend: Push to `main` → Netlify auto-deploys
- Backend: `npm run deploy` packages and updates Lambda
- DynamoDB: Table created via setup script, not CloudFormation (keep it simple)

## GitHub
- Org: `imcpalatine`
- Repo: `volunteer-planner`
