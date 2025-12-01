# How to Run the Migration Command - Step by Step

## Method 1: Using Windows Command Prompt

### Step 1: Open Command Prompt
1. Press the **Windows key** on your keyboard
2. Type: `cmd`
3. Press **Enter**
4. Command Prompt window will open

### Step 2: Navigate to Your Project Folder
Type this command and press Enter:
```bash
cd C:\Users\King\Documents\GitHub\workmangement
```

### Step 3: Run the Migration
Type this command and press Enter:
```bash
npx prisma migrate dev --name add_user_access_overrides
```

### Step 4: Wait for It to Complete
- You'll see messages like "Creating migration..." and "Applying migration..."
- Wait until you see "Migration applied successfully" or similar
- This may take 10-30 seconds

---

## Method 2: Using Windows PowerShell

### Step 1: Open PowerShell
1. Press the **Windows key** on your keyboard
2. Type: `powershell`
3. Press **Enter**
4. PowerShell window will open

### Step 2: Navigate to Your Project Folder
Type this command and press Enter:
```bash
cd C:\Users\King\Documents\GitHub\workmangement
```

### Step 3: Run the Migration
Type this command and press Enter:
```bash
npx prisma migrate dev --name add_user_access_overrides
```

### Step 4: Wait for It to Complete
- You'll see messages about creating and applying the migration
- Wait until completion

---

## Method 3: Using VS Code Terminal (Easiest!)

### Step 1: Open VS Code
1. Open your project in Visual Studio Code
2. If you don't have it open, navigate to: `C:\Users\King\Documents\GitHub\workmangement`

### Step 2: Open Terminal in VS Code
1. Click on **Terminal** in the top menu
2. Click **New Terminal**
   - OR press: `Ctrl + Shift + ` (backtick key, usually above Tab)

### Step 3: Run the Migration
The terminal will already be in your project folder, so just type:
```bash
npx prisma migrate dev --name add_user_access_overrides
```

Press **Enter**

### Step 4: Wait for Completion
- Watch the terminal for progress messages
- You'll see "Migration applied successfully" when done

---

## What You Should See

### Success Messages:
```
✔ Migration created successfully
✔ Migration applied successfully
```

### If You See Errors:
- **"Command not found"** → Make sure you're in the project folder
- **"Cannot find module"** → Run `npm install` first
- **Database connection error** → Check your `.env` file has correct DATABASE_URL

---

## Quick Copy-Paste Commands

### For Command Prompt or PowerShell:
```bash
cd C:\Users\King\Documents\GitHub\workmangement
npx prisma migrate dev --name add_user_access_overrides
```

### If npm packages need updating:
```bash
cd C:\Users\King\Documents\GitHub\workmangement
npm install
npx prisma migrate dev --name add_user_access_overrides
```

---

## After Migration Completes

✅ The `UserAccessOverride` table will be created in your database
✅ You can now use the User Access feature in Admin Panel
✅ No restart needed - it works immediately!

---

## Troubleshooting

### "npx is not recognized"
- Make sure Node.js is installed
- Try: `npm install -g prisma` first

### "Prisma schema not found"
- Make sure you're in the correct folder: `C:\Users\King\Documents\GitHub\workmangement`
- Check that `prisma` folder exists in the project

### "Database connection failed"
- Check your `.env` file
- Make sure DATABASE_URL is correct
- Verify your database is running/accessible

---

## Need Help?

If you get stuck, copy the error message and I can help you fix it!

