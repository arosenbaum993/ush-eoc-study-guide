# US History EOC Study Guide: setup

What's in this folder:

- `index.html`: the interactive study guide, with all 102 questions, Know It reviews, and Help Cards
- `images/`: the 17 cartoons, maps, and photos plus the 19 charts and diagrams (keep this folder next to `index.html`)
- `apps-script/Code.gs`: the script that receives student results and builds the Google Sheet

Students answer questions, then go to **My Results** and press **Send my results**. The page waits for the Sheet to confirm the results arrived before it shows "Sent", so a failed send never looks like a success.

---

## Step 1. Make the results Sheet

1. Sign in with your school Google account and create a new Google Sheet. Name it `USH EOC Study Guide Results`.
2. Click **Extensions > Apps Script**.
3. Delete everything in the `Code.gs` editor. Paste in the whole contents of `apps-script/Code.gs` and click **Save**.
4. In the function menu at the top, choose **setup** and click **Run**. Approve the permission prompts. If Google shows "Google hasn't verified this app", click **Advanced**, then **Go to (project name)**.
5. Go back to the Sheet. It now has three tabs: **Submissions**, **Students**, and **Needs Help**.
6. Optional test: back in Apps Script, choose **testSubmission** and click **Run**. A "Student, Test" row should appear in **Students**. Delete that row and its row in **Submissions** before students start.

## Step 2. Turn the script into a web app

1. In Apps Script, click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
   - If **Anyone** isn't in the list, your Google Workspace admin has restricted it. Ask your tech team to allow it for this one script. The school-only option ("Anyone within McIntosh County Schools") is not reliable here, because the study guide is hosted on GitHub, not on a Google site.
5. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

## Step 3. Put the URL in the study guide

1. Open `index.html` in a text editor (or edit it on GitHub in Step 4).
2. Near the top, find `SCRIPT_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"` and paste your `/exec` URL between the quotes.
3. Optional: to give students a teacher dropdown instead of a typed box, list last names, for example `TEACHERS: ["Smith", "Jones"]`. Typed names vary ("Mr. Smith", "smith"), and each version becomes a separate group on the Sheet, so a dropdown keeps the data clean.
4. Optional: change `PERIODS` to match your bell schedule.

Until a real `/exec` URL is in place, the page tells students that sending is not turned on and offers **Copy my results** instead.

## Step 4. Publish on GitHub Pages

1. On GitHub (account `arosenbaum993`), create a new **public** repository, for example `ush-eoc-study-guide`.
2. Click **Add file > Upload files** and drag in `index.html`, the `images` folder, and this README. Commit.
3. Go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
4. After a minute or two, the guide is live at `https://arosenbaum993.github.io/ush-eoc-study-guide/`.

## Step 5. Test with a real student account before you assign it

The district content filter has blocked embedded pages before, so test on a student Chromebook signed in with a student account:

1. Open the GitHub Pages link.
2. Answer one question and press **Check answer**.
3. Go to **My Results**, fill in the name, teacher, and period, and press **Send my results**.
4. You should see "Sent. Your teacher received your results at..." and a new row in the Sheet.

If the page loads but sending says "Not sent: the teacher's sheet did not answer", the filter is blocking `script.google.com` for students. Ask the tech team to allow `script.google.com` and `script.googleusercontent.com`.

## Step 6. Give it to students

Post the GitHub Pages link in Google Classroom as a **Material** link, not as an attached `.html` file. Tell students to press **Send my results** whenever they finish a practice session. The page reminds them when they've answered more since their last send.

---

## Reading the Sheet

- **Students**: one row per student. The latest send replaces their earlier one, and **Times sent** counts the sends. Domain % and standard % are based on the points each student attempted. Red means under 70% and green means 70% or above. A blank cell means the student hasn't tried that standard yet.
- **Needs Help**: every domain and standard, listed with the students under 70% (lowest first) and a count of how many haven't attempted it. Use it to build small groups. Each student's **Missed questions** on the Students tab (for example `Q12 4a`) tells you which element to reteach, and the Element Map in the teacher key lists the Help Cards for that element.
- **Submissions**: every send, unchanged, for a history of growth over time.

To use a cutoff other than 70%, change `const CUTOFF = 0.70;` at the top of the script, save, and run **setup** again.

## Updating the script later

If you change `Code.gs`, go to **Deploy > Manage deployments**, click the pencil icon, set **Version** to **New version**, and click **Deploy**. The `/exec` URL stays the same, so the study guide does not need to change.

## Things to know

- **Answers are saved on the device:** they live in the student's browser on that device. A student who switches Chromebooks starts over, but everything they already sent stays in the Sheet.
- **The key is visible to a determined student:** answer keys are encoded in the page, which stops a casual peek but not someone who digs through the source. Use this for practice and diagnosis, not as a graded test.
- **Keep the Sheet private:** it holds student names and scores, so share it only with the US History teachers who need it.
