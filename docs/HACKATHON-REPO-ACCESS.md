# Hackathon Repo Access Setup

**Required by**: Backblaze Generative AI Media Hackathon  
**Reason**: Private repositories must grant `b2genblaze` contributor access for judging

## Steps to Grant Access

1. Go to: https://github.com/udirobert/nuncio/settings/access
2. Click **"Add people"**
3. Search for: `b2genblaze`
4. Select role: **Read** (or **Write** if you want judges to be able to open PRs)
5. Click **"Add"**
6. Confirm the invitation in your email

## What Judges Need to See

✅ Working app URL: https://nuncio.persidian.com  
✅ GitHub repo with setup instructions: `README.md` + `AGENTS.md`  
✅ B2 and Genblaze usage documented: `docs/DEVPOST-BACKBLAZE.md`  
✅ Demo video (to be recorded)

## Repo Already Has

- ✅ `.gitignore` excludes all `.env` files
- ✅ No secrets committed (only `.env.example` tracked)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Clear setup instructions
- ✅ Production deployment script
- ✅ Genblaze worker README with setup steps

## Checklist Before Submission

- [ ] Grant `b2genblaze` contributor access
- [ ] Record 3-min demo video showing:
  - User creates video in studio
  - Video renders via HeyGen
  - B2 persist endpoint called (check network tab)
  - Share page loads video via presigned URL
  - Genblaze worker logs show composite generation
- [ ] Verify demo video is < 3 minutes
- [ ] Submit via Devpost before **Aug 4, 2026 @ 12:00am GMT+3**

## Notes

- Repo is currently **private**. If you want it public for portfolio purposes, you can change visibility after granting judge access.
- The `b2genblaze` account is Backblaze's official judging account. Granting read access is safe and required for evaluation.
- All production credentials are in `.env` files which are gitignored. Judges will see the setup instructions but not the actual secrets.
