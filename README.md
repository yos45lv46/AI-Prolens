# ProLens AI Tutor - Deployment Guide

This project is a React application powered by Google Gemini API. It uses Vite as the build tool.

## How to Deploy to the Web

### Option 1: Vercel (Recommended)
1. **Push to GitHub**: Upload this project code to a GitHub repository.
2. **Sign up for Vercel**: Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. **Import Project**: Click "Add New Project" and select your repository.
4. **Environment Variables**: 
   - In the "Configure Project" screen, find the "Environment Variables" section.
   - Add a variable named `API_KEY`.
   - Paste your Google Gemini API Key as the value.
5. **Deploy**: Click "Deploy". Vercel will build your site and give you a live URL.

### Option 2: Netlify
1. **Push to GitHub**.
2. **Sign up for Netlify**: Go to [netlify.com](https://netlify.com).
3. **New Site from Git**: Choose your repository.
4. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Environment Variables**: Click "Advanced" and add your `API_KEY`.
6. **Deploy Site**.

## Custom Domain
After deploying to Vercel or Netlify, go to the project "Settings" -> "Domains" to add your own custom URL (e.g., www.your-camera-course.com).

## Important Note on Data
This app uses **Local Storage** and **IndexedDB** to save student progress and uploaded files directly in their browser. It does not use a central backend database.
- **Advantage**: Free to host, very fast, private.
- **Limitation**: If a student clears their browser cache or switches devices, their progress is not synced automatically.
