# Family Law Automation

A Next.js app router project for a family law matter intake workflow. The home page contains a TypeScript/Tailwind skeleton matching the attached intake form screenshots.

## Stack

- Next.js app router
- TypeScript
- React
- Tailwind CSS

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Adobe Acrobat Sign

Direct Adobe sending uses the Acrobat Sign REST API from server-side routes. Configure:

- `ADOBE_SIGN_ACCESS_TOKEN`
- `ADOBE_SIGN_API_BASE_URL` such as `https://api.na1.adobesign.com/api/rest/v6`
- `ADOBE_SIGN_PROTECTION_ORDER_LIBRARY_DOCUMENT_ID` for the Protection Order induction template
- `ADOBE_SIGN_PARENTING_ORDER_LIBRARY_DOCUMENT_ID` for the Parenting Order induction template
- `ADOBE_SIGN_BOTH_LIBRARY_DOCUMENT_ID` for the combined Protection Order and Parenting Order template
- `ADOBE_SIGN_LIBRARY_DOCUMENT_ID` as a fallback induction template containing documents 1-8 only
- `ADOBE_SIGN_GROUP_ID` if the Adobe account requires a group context

## Vercel

This project uses the standard Next.js structure and scripts expected by Vercel:

- `npm run build` runs `next build`
- `app/` contains the app router entry points
- no custom server is required
