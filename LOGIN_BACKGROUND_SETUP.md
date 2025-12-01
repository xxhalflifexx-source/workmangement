# How to Upload Background Image for Login Page

## Steps to Add a Background Image

### Step 1: Prepare Your Image
1. Choose an image file (JPG, PNG, or WebP format recommended)
2. Recommended dimensions: 1920x1080px or larger for best quality
3. Optimize the image size (aim for under 500KB for faster loading)
4. Name your image file (e.g., `login-background.jpg`)

### Step 2: Upload the Image to Your Project

#### Option A: Using File Explorer (Windows/Mac)
1. Navigate to your project folder: `C:\Users\King\Documents\GitHub\workmangement`
2. Open the `public` folder
3. Copy your image file into the `public` folder
4. Rename it to `login-background.jpg` (or update the path in the code)

#### Option B: Using Command Line
```bash
# Navigate to your project directory
cd C:\Users\King\Documents\GitHub\workmangement

# Copy your image to the public folder
# Windows PowerShell:
Copy-Item "path\to\your\image.jpg" "public\login-background.jpg"

# Or on Mac/Linux:
cp path/to/your/image.jpg public/login-background.jpg
```

#### Option C: Using GitHub Desktop or Git
1. Open your project in GitHub Desktop
2. Navigate to the `public` folder
3. Drag and drop your image file into the `public` folder
4. Commit the changes

### Step 3: Update the Image Path (if needed)

If you named your image differently, update the path in `app/login/page.tsx`:

```tsx
// Find this line (around line 25):
backgroundImage: "url('/login-background.jpg')",

// Change 'login-background.jpg' to your image filename
// Example:
backgroundImage: "url('/my-custom-background.png')",
```

**Note:** The path starts with `/` because files in the `public` folder are served from the root URL.

### Step 4: Adjust Overlay Opacity (Optional)

If you want to change the overlay darkness, edit the `bg-opacity` value in `app/login/page.tsx`:

```tsx
// Find this line (around line 29):
<div className="absolute inset-0 bg-black bg-opacity-40"></div>

// Change the number (40 = 40% opacity):
// - Lower number (20-30) = lighter overlay, more visible background
// - Higher number (50-70) = darker overlay, less visible background
// Example for lighter overlay:
<div className="absolute inset-0 bg-black bg-opacity-30"></div>
```

### Step 5: Test Your Changes

1. Save all files
2. Restart your development server if it's running:
   ```bash
   npm run dev
   ```
3. Navigate to `http://localhost:3000/login` (or your dev URL)
4. Verify the background image appears with the overlay

## Alternative: Use a Gradient Background

If you prefer not to use an image, you can replace the background with a gradient:

```tsx
// Replace the background div with:
<div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500"></div>
```

## Troubleshooting

### Image Not Showing?
1. **Check the file path**: Make sure the image is in the `public` folder
2. **Check the filename**: Ensure it matches exactly (case-sensitive)
3. **Clear browser cache**: Hard refresh with `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. **Check file format**: Use JPG, PNG, or WebP formats

### Image Too Large/Slow Loading?
1. Compress the image using tools like:
   - [TinyPNG](https://tinypng.com/)
   - [Squoosh](https://squoosh.app/)
   - Image optimization in Photoshop/GIMP
2. Consider using WebP format for better compression

### Overlay Too Dark/Light?
- Adjust the `bg-opacity` value (see Step 4)
- Or change the overlay color from `bg-black` to `bg-white` for a lighter effect

## Current Implementation

The login page now includes:
- ✅ Background image support (with fallback to gray background)
- ✅ Low-opacity black overlay (40% opacity) for better text readability
- ✅ Semi-transparent white card with backdrop blur effect
- ✅ Responsive design that works on all screen sizes
- ✅ All existing functionality preserved

