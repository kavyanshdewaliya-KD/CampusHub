# 🎓 Campusmate — IET DAVV CSE-B

Campusmate is a high-utility, mobile-first Web Application and Progressive Web App (PWA) engineered specifically for the 80-student batch of **IET DAVV CSE-B**. Built to streamline academic life, it bridges personal productivity with batch-wide connectivity in one real-time dashboard.

---

## 🔥 Key Features

### 📅 Smart Timetable & Attendance Tracker
* **Batch Filtering:** Instantly toggle between **Batch 1** and **Batch 2** schedules pre-loaded directly from official verified course timetables.
* **Personalized Attendance Tracking:** Tap or press-and-hold calendar dates to mark classes as present or absent. Automatically calculates subject-wise and overall attendance percentages with a visual **75% threshold target** (Green ≥ 75%, Red < 75%).

### 📚 Integrated Study Hub
* **Assignment & Project Tracker:** View upcoming assignments, due dates, and batch-specific tasks with interactive completion checkmarks.
* **MST & Exam Center:** Dedicated portal for upcoming Mid-Sem Tests (MSTs), test dates, and subject-wise syllabus coverage.
* **Topic Checklists:** Track syllabus completion unit-by-unit throughout the semester.

### 💬 Batch Communication & Presence
* **Combined Class Discussion Board:** Unified chat space for both batches featuring an emoji picker, custom sticker packs, and quick updates.
* **Live Presence Tracker:** Real-time active member status powered by Firebase Realtime Database, showing who is currently online in the class.

### 🔐 Multi-Tier Security & Personalization
* **Google Authentication:** Secure sign-in powered by Firebase Auth.
* **Role-Based Permissions:** Admin / CR controls allow Class Representatives to update timetables, post notices, and publish assignment deadlines, while preserving read-only access for students.
* **Privacy-First Design:** Personal attendance records and study checkmarks stay private to each user's account.

---

## 🛠️ Tech Stack

* **Frontend:** React / Vite, Tailwind CSS (Mobile-First UI Design)
* **Backend & Auth:** Firebase Authentication (Google OAuth 2.0)
* **Databases:** 
  * **Cloud Firestore:** Structured class data (Assignments, Syllabus, Exam Schedules)
  * **Firebase Realtime Database:** Live active member tracking & presence
* **Hosting & Deployment:** GitHub + Vercel (Continuous Deployment)

---

## 💻 Footer & Attribution

> **Built by KAVYANSH 🚀** 