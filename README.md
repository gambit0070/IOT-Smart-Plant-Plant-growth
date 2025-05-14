# IOT-Smart-Plant-Plant-growth
To maintain a clean and collaborative development process, we use a protected main branch. This means no direct commits or pushes are allowed to main, and pull requests (PRs) require at least one approval from another team member.

🔒 Branch Rules
❌ Do NOT commit or push directly to main

✅ All changes must go through a Pull Request (PR)

🔁 PRs must be reviewed and approved by at least one other contributor

🔄 PRs should be updated with the latest main before merging (if required)

🛠️ Development Workflow
Create a new branch from main
Name it based on the feature or bug you're working on:

bash
Copy
Edit
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
Work on your feature
Add, commit, and push your changes:

bash
Copy
Edit
git add .
git commit -m "feat: add X functionality"
git push origin feature/your-feature-name
Create a Pull Request (PR)

Go to GitHub → Open a PR from your branch to main

Provide a clear title and description of what’s changed

Request a review

Tag at least one teammate for review

Address feedback if needed

Merge after approval

Once approved and checks pass, click “Merge pull request”

Delete the branch after merging to keep the repo clean