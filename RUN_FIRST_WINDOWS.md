# Run first on Windows

1. Extract this zip.
2. Open PowerShell in the extracted folder:

```powershell
cd C:\Dev\mymauritiustrip
```

3. Confirm this file exists:

```powershell
dir package.json
```

4. Install and run:

```powershell
npm install
copy .env.local.example .env.local
npx tsc --noEmit
npm run dev
```

Open http://localhost:3000
