# End-of-Day Email Report

## Overview

The End-of-Day (EOD) Email Report automatically sends daily summaries to organization admins at 6 PM Central time. The report includes:

- **Employee Activity**: Hours worked, pay earned, jobs worked, work descriptions
- **Job Profit Snapshots**: Revenue, costs (today + to-date), profit, margin
- **Exceptions & Flags**: Open entries, missing notes, over-cap flags, low margins, missing revenue

## Configuration

### Environment Variables

The following environment variables are required:

| Variable | Description | Required |
|----------|-------------|----------|
| `RESEND_API_KEY` | Resend API key for sending emails | Yes |
| `CRON_SECRET` | Secret for authenticating cron requests | Recommended |
| `PRODUCTION_URL` | Base URL for links in email (default: `https://shoptofield.com/app`) | Optional |

### Cron Schedule

The EOD report runs daily at midnight UTC (approximately 6-7 PM Central, depending on daylight saving time).

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/eod-report",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Recipients

By default, the report is sent to all users with `ADMIN` or `MANAGER` role in each organization who have a verified email address.

## Report Content

### Employee Section

For each employee who logged time today:

- **Name & Email**
- **Hours**: Net work time (breaks excluded), break time, paid hours
- **Pay**: Labor cost calculated from hourly rate
- **Jobs Worked**: List with hours per job
- **Work Description**: Up to 3 bullets from clock-in/clock-out notes
- **Flags**: Open entries, missing notes, over-cap status

### Job Profit Snapshot

For each job that had labor logged today:

| Field | Description |
|-------|-------------|
| Revenue | `finalPrice` (preferred) or `estimatedPrice` |
| Cost Today | Labor + materials + other costs recorded today |
| Cost to Date | All-time accumulated costs |
| Profit | Revenue - Cost to Date |
| Margin | Profit / Revenue (percentage) |

### Exceptions & Flags

The report highlights:

- **Open time entries**: Employees who haven't clocked out
- **Over-cap flagged**: Entries exceeding 16-hour net work cap
- **Missing notes**: Entries without descriptions
- **Missing revenue**: Jobs without pricing set
- **Low margin**: Jobs with margin below 20%
- **Over budget**: Jobs where costs exceed revenue

## API Endpoints

### Trigger Report Manually

```bash
# Dry run (preview, no email sent)
curl -X GET "https://your-domain.com/api/cron/eod-report?dry_run=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Send report for specific organization
curl -X GET "https://your-domain.com/api/cron/eod-report?org_id=ORG_ID" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Send all reports
curl -X GET "https://your-domain.com/api/cron/eod-report" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Testing

### Run Unit Tests

```bash
npm run test:eod
```

Or run all EOD report tests:

```bash
npx jest __tests__/unit/lib/eod-report-service.test.ts
```

### Self-Test Script

The self-test script runs unit tests and generates a dry-run preview:

```bash
npx tsx scripts/self_test_eod_report.ts
```

## Code Structure

```
lib/
  eod-report-service.ts    # Report data aggregation
  email.ts                 # sendEodReportEmail function

app/api/cron/
  eod-report/
    route.ts               # Cron job endpoint

__tests__/unit/lib/
  eod-report-service.test.ts

scripts/
  self_test_eod_report.ts
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `EOD_REPORT_HOUR` | 18 | 6 PM (not directly used; cron controls timing) |
| `MARGIN_ALERT_THRESHOLD` | 0.20 | 20% margin threshold for alerts |
| `MAX_NOTES_BULLETS` | 3 | Max work description bullets shown |

## Troubleshooting

### Email not sending

1. Check `RESEND_API_KEY` is set correctly
2. Verify the API key starts with `re_`
3. Check Resend dashboard for sending limits

### No recipients found

- Ensure organization has users with `ADMIN` or `MANAGER` role
- Verify user status is `APPROVED`
- Check users have email addresses set

### Report shows no data

- Verify time entries exist for the report date
- Check entries have `organizationId` set
- Ensure jobs are linked to time entries

## Future Enhancements

- Configurable report time per organization
- Custom recipient lists (stored in `CompanySettings`)
- Weekly/monthly summary reports
- Export to PDF attachment
- Slack/Teams webhook integration

