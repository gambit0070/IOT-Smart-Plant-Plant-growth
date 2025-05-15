# IOT-Smart-Plant-Plant-growth

## To do plan

1 connect controller to blink cloud and blink app

2 Air and soil humidity and temperature have own radial gauge to show last measures

3 manual switch on/off buttom for water pump. Dmitry

4 implement the automated water pump control by setting logic turn onn pump if water soil <*** turn of if > ****  Dmitry

5 make notifications for app if the any of measurements out of normal range

6 User should be able to set humidity manually in app for controlling the pump triggers

7 User should be able to adjust measuments normal ranges manually in the app Dmitry

8 Controller suppose to have different sets of work. ! set is a different plan with different frequancy of measurements and ranges for different type of plants. Different sets should be on controllers and user have dropmenu in app to choose any of them. For example should be different modes for flowers, herbs etc.                        Amber

9 we need dashboard in the app for showing measurements changes for past week

10 add light sensor and lump to system for light control and add the light settings to previous steps

11 Fan switch buttom and user should have dropmenu where he can choose fan roation speed


## Safety features

1 System should make soil humidity checks more frewuent when the water pump is working. If soil humidity is not increeasing app sending notification to user "Check the pump"

2 Check if the lamp turned on but light level did not increase, send message to user " Check lamp"

3 if the soil humidity is not decreasing for long time send message " check soil drainage or soil humidity" Dmitry

4 emergency pump stop if water humidity came to high at watering process

5 turning fan on max speed when tempreture too hot. DMitry

































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