# Monthly Quotas

Monthly quotas let you set cost limits on providers and models. When a quota is set, the dashboard shows usage progress bars and warns when you're approaching the limit.

## Setting Quotas

1. Go to **Providers** in the dashboard
2. Click **Edit** on a provider or model
3. Fill in **Monthly Quota Cost** (USD)
4. Save

## Quota Visualization

The **Usage** page displays:
- **Green** progress bar — under 80% of quota
- **Amber** progress bar — 80-99% of quota
- **Red** progress bar — at or over 100% of quota

The **Overview** page shows a warning card for any provider at risk (>= 80% usage).

## Quota Calculation

Usage is calculated from the `UsageLog` table, summing `cost` for the current calendar month:

```
used = SUM(cost) WHERE timestamp >= start_of_month
remaining = quota - used
percentage = (used / quota) * 100
```

## Database Schema

Quotas are stored as optional fields on Provider and Model:

```prisma
model Provider {
  ...
  monthlyQuotaCost Float?
}

model Model {
  ...
  monthlyQuotaCost Float?
}
```

## Behavior

Quotas are **informational only** — they do not block requests. The routing engine does not currently enforce quota limits. Use them for monitoring and budgeting.

## Adding Quotas via API

You can also set quotas through Prisma or database migrations directly:

```sql
UPDATE providers SET monthly_quota_cost = 10.00 WHERE name = 'openai';
UPDATE models SET monthly_quota_cost = 5.00 WHERE external_id = 'gpt-4o';
```
