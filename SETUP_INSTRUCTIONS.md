# Setup Instructions

## Quick Start to Reset Everything

If you want to start fresh with new user accounts, follow these steps:

### Option 1: Delete Database and Regenerate (Recommended)

1. **Stop the dev server** (Ctrl+C in the terminal where it's running)

2. **Delete the database file:**
   ```powershell
   cd nextjs-auth-roles/prisma
   Remove-Item dev.db
   ```

3. **Regenerate the database:**
   ```powershell
   cd ..
   npx prisma db push
   ```

4. **Restart the dev server:**
   ```powershell
   npm run dev
   ```

5. **Register a new admin account:**
   - Go to: http://localhost:3000/register
   - Fill in your details
   - Use registration code: `moonlight` (for ADMIN role)
   - Check your email for verification code
   - Verify your account

### Registration Codes

When registering, use these codes for different roles:
- **`moonlight`** = ADMIN (full access)
- **`sunset`** = MANAGER (can manage jobs, HR, inventory)
- **`sunrise`** = EMPLOYEE (basic access)
- **(leave empty)** = EMPLOYEE (default)

## Setting Up Company Information

Once you have an admin account:

1. Login and go to **Dashboard**
2. Click **Administrative** (red card, admin-only)
3. Go to **🏢 Company Settings** tab
4. Fill in your company information:
   - Company Name
   - Address
   - City, State, ZIP
   - Phone
   - Email
   - Website
5. Click **Save Company Settings**

**This information will automatically appear on all invoices!**

## Generating Invoices

As a Manager or Admin:

1. Go to **Jobs** page
2. Make sure the job has:
   - A customer assigned
   - Time entries (hours worked)
3. Click the **📄 Invoice** button
4. The invoice will auto-populate with:
   - Your company info (from settings)
   - Customer info (from job)
   - Labor hours and costs (from time entries)
5. Edit line items, add notes, adjust rates
6. Click **🖨️ Print Invoice** to print or save as PDF

## Key Features

### For All Users:
- ⏰ Time Clock (track work hours)
- 📋 Jobs (view assigned jobs)
- 📦 Inventory (check stock)

### For Managers & Admins:
- 👥 HR (view team time records)
- 📖 Employee Handbook
- 📄 Generate Invoices
- 📦 Manage Material Requests

### For Admins Only:
- ⚙️ Administrative Panel
  - 👥 User Management (delete users, change roles)
  - 🏢 Company Settings (edit company info)

## Troubleshooting

### If npm/npx commands don't work:
Use the full path:
```powershell
& "C:\Program Files\nodejs\npx.cmd" prisma db push
```

### If the dev server isn't running:
```powershell
cd nextjs-auth-roles
npm run dev
```

### If you can't login:
Make sure you've verified your email with the 6-digit code sent during registration.

### If you need to clear all users:
Delete the database (Option 1 above) and re-register.

## Support

For issues or questions, check the logs in your terminal where the dev server is running.



